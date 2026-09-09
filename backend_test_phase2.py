#!/usr/bin/env python3
"""
Phase 2 Backend API Tests for Aptiva RL Corporate Platform
Tests NEW PUT/DELETE endpoints + regression tests
"""
import requests
import json
import sys
import time
from typing import Dict, Optional

# Configuration
BASE_URL = "https://aptiva-db.preview.emergentagent.com/api"

# Demo users (password: Aptiva2025!)
USERS = {
    "admin": {"email": "admin@aptivarl.com", "password": "Aptiva2025!", "role": "SUPER_ADMIN_HOLDING"},
    "empresa": {"email": "empresa@aptivarl.com", "password": "Aptiva2025!", "role": "ADMIN_EMPRESA"},
    "revisor": {"email": "revisor@aptivarl.com", "password": "Aptiva2025!", "role": "REVISOR"},
    "mandante": {"email": "mandante@aptivarl.com", "password": "Aptiva2025!", "role": "USUARIO_MANDANTE"}
}

# Test state
tokens = {}
profiles = {}
test_ids = {
    "mandante_id": None,
    "empresa_id": None,
    "contrato_id": None,
    "trabajador_id": None,
    "categoria_id": None,
    "requisito_id": None,
    "gerencia_id": None
}

def log_test(name: str, passed: bool, details: str = ""):
    """Log test result"""
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"{status}: {name}")
    if details:
        print(f"   Details: {details}")
    return passed

def make_request(method: str, endpoint: str, token: Optional[str] = None, data: Optional[Dict] = None, params: Optional[Dict] = None):
    """Make HTTP request with proper headers"""
    url = f"{BASE_URL}{endpoint}"
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    
    if data is not None:
        headers["Content-Type"] = "application/json"
    
    time.sleep(0.3)
    
    try:
        if method == "GET":
            resp = requests.get(url, headers=headers, params=params, timeout=30)
        elif method == "POST":
            resp = requests.post(url, headers=headers, json=data, timeout=30)
        elif method == "PUT":
            resp = requests.put(url, headers=headers, json=data, timeout=30)
        elif method == "DELETE":
            resp = requests.delete(url, headers=headers, timeout=30)
        else:
            raise ValueError(f"Unsupported method: {method}")
        
        return resp
    except requests.exceptions.Timeout as e:
        print(f"   ⚠️  Request timeout after 30s: {str(e)}")
        return None
    except requests.exceptions.RequestException as e:
        print(f"   ⚠️  Request error: {str(e)}")
        return None
    except Exception as e:
        print(f"   ⚠️  Unexpected error: {str(e)}")
        return None

# ============================================================================
# REGRESSION TESTS
# ============================================================================

def test_regression_login_all_users():
    """Regression: Login for all 4 demo users"""
    print("\n=== REGRESSION: Login All Demo Users ===")
    all_passed = True
    
    for user_key, user_data in USERS.items():
        resp = make_request("POST", "/auth/login", data={
            "email": user_data["email"],
            "password": user_data["password"]
        })
        
        if not resp:
            log_test(f"Login {user_key}", False, "Request failed")
            all_passed = False
            continue
        
        if resp.status_code != 200:
            log_test(f"Login {user_key}", False, f"Expected 200, got {resp.status_code}: {resp.text}")
            all_passed = False
            continue
        
        data = resp.json()
        if "token" not in data or "profile" not in data:
            log_test(f"Login {user_key}", False, f"Missing token or profile: {data}")
            all_passed = False
            continue
        
        profile = data["profile"]
        if profile.get("role_codigo") != user_data["role"]:
            log_test(f"Login {user_key}", False, f"Expected role {user_data['role']}, got {profile.get('role_codigo')}")
            all_passed = False
            continue
        
        tokens[user_key] = data["token"]
        profiles[user_key] = profile
        log_test(f"Login {user_key}", True, f"Role: {profile['role_codigo']}")
    
    return all_passed

def test_regression_dashboard():
    """Regression: GET /api/dashboard returns stats + acreditacion_por_mandante"""
    print("\n=== REGRESSION: Dashboard Stats ===")
    resp = make_request("GET", "/dashboard", token=tokens["admin"])
    
    if not resp:
        return log_test("Dashboard", False, "Request failed")
    
    if resp.status_code != 200:
        return log_test("Dashboard", False, f"Expected 200, got {resp.status_code}: {resp.text}")
    
    data = resp.json()
    if "stats" not in data or "acreditacion_por_mandante" not in data:
        return log_test("Dashboard", False, f"Missing required fields: {data.keys()}")
    
    return log_test("Dashboard", True, f"Stats OK, mandantes={data['stats'].get('mandantes')}")

def test_regression_trabajador_acreditacion():
    """Regression: GET /api/trabajadores/:id returns acreditacion array"""
    print("\n=== REGRESSION: Trabajador Acreditacion Array ===")
    
    # Get a trabajador ID
    resp = make_request("GET", "/trabajadores", token=tokens["admin"])
    if not resp or resp.status_code != 200:
        return log_test("Trabajador acreditacion", False, "Failed to get trabajadores list")
    
    trabajadores = resp.json().get("trabajadores", [])
    if not trabajadores:
        return log_test("Trabajador acreditacion", False, "No trabajadores available")
    
    trabajador_id = trabajadores[0]["trabajador_id"]
    
    resp = make_request("GET", f"/trabajadores/{trabajador_id}", token=tokens["admin"])
    
    if not resp:
        return log_test("Trabajador acreditacion", False, "Request failed")
    
    if resp.status_code != 200:
        return log_test("Trabajador acreditacion", False, f"Expected 200, got {resp.status_code}")
    
    data = resp.json()
    if "acreditacion" not in data:
        return log_test("Trabajador acreditacion", False, f"Missing acreditacion field: {data.keys()}")
    
    if not isinstance(data["acreditacion"], list):
        return log_test("Trabajador acreditacion", False, f"acreditacion is not a list: {type(data['acreditacion'])}")
    
    return log_test("Trabajador acreditacion", True, f"Acreditacion array present, length={len(data['acreditacion'])}")

# ============================================================================
# PHASE 2: GET /api/mandantes/:id now returns categorias array
# ============================================================================

def test_mandante_detail_includes_categorias():
    """Phase 2: GET /api/mandantes/:id returns categorias array"""
    print("\n=== PHASE 2: Mandante Detail Includes Categorias ===")
    
    # Get a mandante ID
    resp = make_request("GET", "/mandantes", token=tokens["admin"])
    if not resp or resp.status_code != 200:
        return log_test("Mandante detail categorias", False, "Failed to get mandantes list")
    
    mandantes = resp.json().get("mandantes", [])
    if not mandantes:
        return log_test("Mandante detail categorias", False, "No mandantes available")
    
    mandante_id = mandantes[0]["mandante_id"]
    test_ids["mandante_id"] = mandante_id
    
    resp = make_request("GET", f"/mandantes/{mandante_id}", token=tokens["admin"])
    
    if not resp:
        return log_test("Mandante detail categorias", False, "Request failed")
    
    if resp.status_code != 200:
        return log_test("Mandante detail categorias", False, f"Expected 200, got {resp.status_code}")
    
    data = resp.json()
    required_fields = ["mandante", "empresas", "gerencias", "contratos", "requisitos", "categorias", "trabajadores"]
    missing = [f for f in required_fields if f not in data]
    
    if missing:
        return log_test("Mandante detail categorias", False, f"Missing fields: {missing}")
    
    if not isinstance(data["categorias"], list):
        return log_test("Mandante detail categorias", False, f"categorias is not a list: {type(data['categorias'])}")
    
    # Store empresa_id for later tests
    if data["empresas"]:
        test_ids["empresa_id"] = data["empresas"][0]["empresa_id"]
    
    # Store contrato_id for later tests
    if data["contratos"]:
        test_ids["contrato_id"] = data["contratos"][0]["contrato_id"]
    
    return log_test("Mandante detail categorias", True, f"Categorias array present, length={len(data['categorias'])}")

# ============================================================================
# PHASE 2: PUT /api/mandantes/:id
# ============================================================================

def test_put_mandante_as_admin():
    """Phase 2: PUT /api/mandantes/:id as admin -> 200"""
    print("\n=== PHASE 2: PUT Mandante (admin) ===")
    
    if not test_ids["mandante_id"]:
        return log_test("PUT mandante (admin)", False, "No mandante ID available")
    
    # Update razon_social
    resp = make_request("PUT", f"/mandantes/{test_ids['mandante_id']}", token=tokens["admin"], data={
        "razon_social": "Updated Mandante Name"
    })
    
    if not resp:
        return log_test("PUT mandante (admin)", False, "Request failed")
    
    if resp.status_code != 200:
        return log_test("PUT mandante (admin)", False, f"Expected 200, got {resp.status_code}: {resp.text}")
    
    data = resp.json()
    if "mandante" not in data:
        return log_test("PUT mandante (admin)", False, f"Missing mandante field: {data}")
    
    if data["mandante"]["razon_social"] != "Updated Mandante Name":
        return log_test("PUT mandante (admin)", False, f"razon_social not updated: {data['mandante']['razon_social']}")
    
    return log_test("PUT mandante (admin)", True, f"Updated razon_social to: {data['mandante']['razon_social']}")

def test_put_mandante_activo_false():
    """Phase 2: PUT /api/mandantes/:id with activo:false as admin -> 200"""
    print("\n=== PHASE 2: PUT Mandante activo=false (admin) ===")
    
    if not test_ids["mandante_id"]:
        return log_test("PUT mandante activo=false", False, "No mandante ID available")
    
    resp = make_request("PUT", f"/mandantes/{test_ids['mandante_id']}", token=tokens["admin"], data={
        "activo": False
    })
    
    if not resp:
        return log_test("PUT mandante activo=false", False, "Request failed")
    
    if resp.status_code != 200:
        return log_test("PUT mandante activo=false", False, f"Expected 200, got {resp.status_code}: {resp.text}")
    
    data = resp.json()
    if data["mandante"]["activo"] != False:
        return log_test("PUT mandante activo=false", False, f"activo not updated: {data['mandante']['activo']}")
    
    # Restore activo=true for other tests
    make_request("PUT", f"/mandantes/{test_ids['mandante_id']}", token=tokens["admin"], data={"activo": True})
    
    return log_test("PUT mandante activo=false", True, "Updated activo to false")

def test_put_mandante_as_mandante_user():
    """Phase 2: PUT /api/mandantes/:id as mandante (USUARIO_MANDANTE) -> 403"""
    print("\n=== PHASE 2: PUT Mandante (mandante user - should fail) ===")
    
    if not test_ids["mandante_id"]:
        return log_test("PUT mandante (mandante)", False, "No mandante ID available")
    
    resp = make_request("PUT", f"/mandantes/{test_ids['mandante_id']}", token=tokens["mandante"], data={
        "razon_social": "Unauthorized Update"
    })
    
    if not resp:
        return log_test("PUT mandante (mandante)", False, "Request failed")
    
    if resp.status_code == 403:
        return log_test("PUT mandante (mandante)", True, "Correctly rejected with 403")
    else:
        return log_test("PUT mandante (mandante)", False, f"Expected 403, got {resp.status_code}")

# ============================================================================
# PHASE 2: PUT /api/contratos/:id
# ============================================================================

def test_put_contrato_as_admin():
    """Phase 2: PUT /api/contratos/:id as admin -> 200"""
    print("\n=== PHASE 2: PUT Contrato (admin) ===")
    
    if not test_ids["contrato_id"]:
        return log_test("PUT contrato (admin)", False, "No contrato ID available")
    
    # Get current contrato values
    resp_get = make_request("GET", f"/contratos/{test_ids['contrato_id']}", token=tokens["admin"])
    if not resp_get or resp_get.status_code != 200:
        return log_test("PUT contrato (admin)", False, "Failed to get contrato")
    
    original = resp_get.json()["contrato"]
    
    # Update multiple fields
    resp = make_request("PUT", f"/contratos/{test_ids['contrato_id']}", token=tokens["admin"], data={
        "estado": "suspendido",
        "limite_contingente": 50,
        "observaciones": "Updated via Phase 2 test"
    })
    
    if not resp:
        return log_test("PUT contrato (admin)", False, "Request failed")
    
    if resp.status_code != 200:
        return log_test("PUT contrato (admin)", False, f"Expected 200, got {resp.status_code}: {resp.text}")
    
    data = resp.json()
    if "contrato" not in data:
        return log_test("PUT contrato (admin)", False, f"Missing contrato field: {data}")
    
    contrato = data["contrato"]
    
    # Verify values changed
    if contrato["estado"] != "suspendido":
        return log_test("PUT contrato (admin)", False, f"estado not updated: {contrato['estado']}")
    
    if contrato["limite_contingente"] != 50:
        return log_test("PUT contrato (admin)", False, f"limite_contingente not updated: {contrato['limite_contingente']}")
    
    if contrato["observaciones"] != "Updated via Phase 2 test":
        return log_test("PUT contrato (admin)", False, f"observaciones not updated: {contrato['observaciones']}")
    
    # Verify via GET
    resp_verify = make_request("GET", f"/contratos/{test_ids['contrato_id']}", token=tokens["admin"])
    if resp_verify and resp_verify.status_code == 200:
        verified = resp_verify.json()["contrato"]
        if verified["estado"] != "suspendido" or verified["limite_contingente"] != 50:
            return log_test("PUT contrato (admin)", False, "Values not persisted correctly")
    
    return log_test("PUT contrato (admin)", True, f"Updated estado={contrato['estado']}, limite_contingente={contrato['limite_contingente']}")

# ============================================================================
# PHASE 2: PUT /api/trabajadores/:id and DELETE /api/trabajadores/:id
# ============================================================================

def test_put_trabajador_as_admin():
    """Phase 2: PUT /api/trabajadores/:id as admin -> 200"""
    print("\n=== PHASE 2: PUT Trabajador (admin) ===")
    
    # Get a trabajador ID
    resp = make_request("GET", "/trabajadores", token=tokens["admin"])
    if not resp or resp.status_code != 200:
        return log_test("PUT trabajador (admin)", False, "Failed to get trabajadores")
    
    trabajadores = resp.json().get("trabajadores", [])
    if not trabajadores:
        return log_test("PUT trabajador (admin)", False, "No trabajadores available")
    
    trabajador_id = trabajadores[0]["trabajador_id"]
    test_ids["trabajador_id"] = trabajador_id
    
    # Update cargo and telefono
    resp = make_request("PUT", f"/trabajadores/{trabajador_id}", token=tokens["admin"], data={
        "cargo": "Supervisor",
        "telefono": "+56999888777"
    })
    
    if not resp:
        return log_test("PUT trabajador (admin)", False, "Request failed")
    
    if resp.status_code != 200:
        return log_test("PUT trabajador (admin)", False, f"Expected 200, got {resp.status_code}: {resp.text}")
    
    data = resp.json()
    if "trabajador" not in data:
        return log_test("PUT trabajador (admin)", False, f"Missing trabajador field: {data}")
    
    trabajador = data["trabajador"]
    
    if trabajador["cargo"] != "Supervisor":
        return log_test("PUT trabajador (admin)", False, f"cargo not updated: {trabajador['cargo']}")
    
    if trabajador["telefono"] != "+56999888777":
        return log_test("PUT trabajador (admin)", False, f"telefono not updated: {trabajador['telefono']}")
    
    return log_test("PUT trabajador (admin)", True, f"Updated cargo={trabajador['cargo']}, telefono={trabajador['telefono']}")

def test_delete_trabajador_as_admin():
    """Phase 2: DELETE /api/trabajadores/:id as admin -> 200 and soft-deleted"""
    print("\n=== PHASE 2: DELETE Trabajador (admin) ===")
    
    # Create a new trabajador to delete
    if not test_ids["empresa_id"]:
        return log_test("DELETE trabajador (admin)", False, "No empresa ID available")
    
    rut = f"{int(time.time()) % 100000000}-{(int(time.time()) % 9) + 1}"
    
    resp_create = make_request("POST", "/trabajadores", token=tokens["admin"], data={
        "empresa_id": test_ids["empresa_id"],
        "rut": rut,
        "nombre": "To Delete",
        "apellido": "Worker",
        "cargo": "Test"
    })
    
    if not resp_create or resp_create.status_code != 201:
        return log_test("DELETE trabajador (admin)", False, "Failed to create trabajador for deletion")
    
    trabajador_id = resp_create.json()["trabajador"]["trabajador_id"]
    
    # Delete the trabajador
    resp = make_request("DELETE", f"/trabajadores/{trabajador_id}", token=tokens["admin"])
    
    if not resp:
        return log_test("DELETE trabajador (admin)", False, "Request failed")
    
    if resp.status_code != 200:
        return log_test("DELETE trabajador (admin)", False, f"Expected 200, got {resp.status_code}: {resp.text}")
    
    data = resp.json()
    if data.get("ok") != True:
        return log_test("DELETE trabajador (admin)", False, f"Expected {{ok:true}}, got {data}")
    
    # Verify trabajador is excluded from list (soft-deleted)
    resp_list = make_request("GET", "/trabajadores", token=tokens["admin"])
    if resp_list and resp_list.status_code == 200:
        trabajadores = resp_list.json().get("trabajadores", [])
        if any(t["trabajador_id"] == trabajador_id for t in trabajadores):
            return log_test("DELETE trabajador (admin)", False, "Trabajador still appears in list (not soft-deleted)")
    
    return log_test("DELETE trabajador (admin)", True, "Trabajador soft-deleted and excluded from list")

# ============================================================================
# PHASE 2: Document Standard Management (Categorias + Requisitos)
# ============================================================================

def test_create_categoria():
    """Phase 2: POST /api/categorias -> 201"""
    print("\n=== PHASE 2: POST Categoria ===")
    
    if not test_ids["mandante_id"]:
        return log_test("POST categoria", False, "No mandante ID available")
    
    resp = make_request("POST", "/categorias", token=tokens["admin"], data={
        "mandante_id": test_ids["mandante_id"],
        "tipo_recurso": "trabajador",
        "nombre": "Nueva Categoria Test"
    })
    
    if not resp:
        return log_test("POST categoria", False, "Request failed")
    
    if resp.status_code != 201:
        return log_test("POST categoria", False, f"Expected 201, got {resp.status_code}: {resp.text}")
    
    data = resp.json()
    if "categoria" not in data or "categoria_id" not in data["categoria"]:
        return log_test("POST categoria", False, f"Missing categoria or categoria_id: {data}")
    
    test_ids["categoria_id"] = data["categoria"]["categoria_id"]
    
    return log_test("POST categoria", True, f"Created categoria: {data['categoria']['nombre']}")

def test_create_requisito():
    """Phase 2: POST /api/requisitos -> 201"""
    print("\n=== PHASE 2: POST Requisito ===")
    
    if not test_ids["mandante_id"] or not test_ids["categoria_id"]:
        return log_test("POST requisito", False, "No mandante or categoria ID available")
    
    resp = make_request("POST", "/requisitos", token=tokens["admin"], data={
        "mandante_id": test_ids["mandante_id"],
        "tipo_recurso": "trabajador",
        "categoria_id": test_ids["categoria_id"],
        "nombre": "Doc X Test",
        "obligatorio": True,
        "tiene_vencimiento": True,
        "dias_alerta": 15
    })
    
    if not resp:
        return log_test("POST requisito", False, "Request failed")
    
    if resp.status_code != 201:
        return log_test("POST requisito", False, f"Expected 201, got {resp.status_code}: {resp.text}")
    
    data = resp.json()
    if "requisito" not in data or "requisito_id" not in data["requisito"]:
        return log_test("POST requisito", False, f"Missing requisito or requisito_id: {data}")
    
    test_ids["requisito_id"] = data["requisito"]["requisito_id"]
    
    requisito = data["requisito"]
    if requisito["obligatorio"] != True or requisito["tiene_vencimiento"] != True or requisito["dias_alerta"] != 15:
        return log_test("POST requisito", False, f"Values not set correctly: {requisito}")
    
    return log_test("POST requisito", True, f"Created requisito: {requisito['nombre']}, obligatorio={requisito['obligatorio']}")

def test_put_requisito():
    """Phase 2: PUT /api/requisitos/:id -> 200"""
    print("\n=== PHASE 2: PUT Requisito ===")
    
    if not test_ids["requisito_id"]:
        return log_test("PUT requisito", False, "No requisito ID available")
    
    resp = make_request("PUT", f"/requisitos/{test_ids['requisito_id']}", token=tokens["admin"], data={
        "obligatorio": False
    })
    
    if not resp:
        return log_test("PUT requisito", False, "Request failed")
    
    if resp.status_code != 200:
        return log_test("PUT requisito", False, f"Expected 200, got {resp.status_code}: {resp.text}")
    
    data = resp.json()
    if "requisito" not in data:
        return log_test("PUT requisito", False, f"Missing requisito field: {data}")
    
    if data["requisito"]["obligatorio"] != False:
        return log_test("PUT requisito", False, f"obligatorio not updated: {data['requisito']['obligatorio']}")
    
    return log_test("PUT requisito", True, f"Updated obligatorio to false")

def test_delete_requisito():
    """Phase 2: DELETE /api/requisitos/:id -> 200 (soft-deactivates: activo=false)"""
    print("\n=== PHASE 2: DELETE Requisito ===")
    
    if not test_ids["requisito_id"]:
        return log_test("DELETE requisito", False, "No requisito ID available")
    
    resp = make_request("DELETE", f"/requisitos/{test_ids['requisito_id']}", token=tokens["admin"])
    
    if not resp:
        return log_test("DELETE requisito", False, "Request failed")
    
    if resp.status_code != 200:
        return log_test("DELETE requisito", False, f"Expected 200, got {resp.status_code}: {resp.text}")
    
    data = resp.json()
    if data.get("ok") != True:
        return log_test("DELETE requisito", False, f"Expected {{ok:true}}, got {data}")
    
    return log_test("DELETE requisito", True, "Requisito soft-deleted (activo=false)")

# ============================================================================
# PHASE 2: Mandante-Empresa Association
# ============================================================================

def test_create_mandante_empresa_association():
    """Phase 2: POST /api/mandantes/empresas -> 201"""
    print("\n=== PHASE 2: POST Mandante-Empresa Association ===")
    
    # Get all mandantes and empresas
    resp_m = make_request("GET", "/mandantes", token=tokens["admin"])
    resp_e = make_request("GET", "/empresas", token=tokens["admin"])
    
    if not resp_m or not resp_e or resp_m.status_code != 200 or resp_e.status_code != 200:
        return log_test("POST mandante-empresa", False, "Failed to get mandantes/empresas")
    
    mandantes = resp_m.json().get("mandantes", [])
    empresas = resp_e.json().get("empresas", [])
    
    if len(mandantes) < 1 or len(empresas) < 2:
        return log_test("POST mandante-empresa", False, "Not enough mandantes/empresas")
    
    mandante_id = mandantes[0]["mandante_id"]
    
    # Get mandante details to find an unrelated empresa
    resp_detail = make_request("GET", f"/mandantes/{mandante_id}", token=tokens["admin"])
    if not resp_detail or resp_detail.status_code != 200:
        return log_test("POST mandante-empresa", False, "Failed to get mandante details")
    
    related_empresa_ids = [e["empresa_id"] for e in resp_detail.json().get("empresas", [])]
    
    # Find an empresa NOT in the related list
    unrelated_empresa_id = None
    for empresa in empresas:
        if empresa["empresa_id"] not in related_empresa_ids:
            unrelated_empresa_id = empresa["empresa_id"]
            break
    
    if not unrelated_empresa_id:
        return log_test("POST mandante-empresa", True, "SKIP: All empresas already related to mandante")
    
    resp = make_request("POST", "/mandantes/empresas", token=tokens["admin"], data={
        "mandante_id": mandante_id,
        "empresa_id": unrelated_empresa_id
    })
    
    if not resp:
        return log_test("POST mandante-empresa", False, "Request failed")
    
    if resp.status_code != 201:
        return log_test("POST mandante-empresa", False, f"Expected 201, got {resp.status_code}: {resp.text}")
    
    data = resp.json()
    if data.get("ok") != True:
        return log_test("POST mandante-empresa", False, f"Expected {{ok:true}}, got {data}")
    
    # Store for delete test
    test_ids["test_empresa_id"] = unrelated_empresa_id
    test_ids["test_mandante_id"] = mandante_id
    
    return log_test("POST mandante-empresa", True, "Created mandante-empresa association")

def test_delete_mandante_empresa_association():
    """Phase 2: DELETE /api/mandantes/:mandanteId/empresas/:empresaId -> 200"""
    print("\n=== PHASE 2: DELETE Mandante-Empresa Association ===")
    
    if not test_ids.get("test_mandante_id") or not test_ids.get("test_empresa_id"):
        return log_test("DELETE mandante-empresa", True, "SKIP: No association to delete")
    
    mandante_id = test_ids["test_mandante_id"]
    empresa_id = test_ids["test_empresa_id"]
    
    resp = make_request("DELETE", f"/mandantes/{mandante_id}/empresas/{empresa_id}", token=tokens["admin"])
    
    if not resp:
        return log_test("DELETE mandante-empresa", False, "Request failed")
    
    if resp.status_code != 200:
        return log_test("DELETE mandante-empresa", False, f"Expected 200, got {resp.status_code}: {resp.text}")
    
    data = resp.json()
    if data.get("ok") != True:
        return log_test("DELETE mandante-empresa", False, f"Expected {{ok:true}}, got {data}")
    
    # Verify empresa no longer appears in mandante detail
    resp_detail = make_request("GET", f"/mandantes/{mandante_id}", token=tokens["admin"])
    if resp_detail and resp_detail.status_code == 200:
        empresas = resp_detail.json().get("empresas", [])
        if any(e["empresa_id"] == empresa_id for e in empresas):
            return log_test("DELETE mandante-empresa", False, "Empresa still appears in mandante detail")
    
    return log_test("DELETE mandante-empresa", True, "Association soft-deleted (activo=false)")

# ============================================================================
# PHASE 2: Gerencias
# ============================================================================

def test_create_gerencia():
    """Phase 2: POST /api/mandantes/gerencias -> 201"""
    print("\n=== PHASE 2: POST Gerencia ===")
    
    if not test_ids["mandante_id"]:
        return log_test("POST gerencia", False, "No mandante ID available")
    
    resp = make_request("POST", "/mandantes/gerencias", token=tokens["admin"], data={
        "mandante_id": test_ids["mandante_id"],
        "nombre": "Gerencia Test Phase 2"
    })
    
    if not resp:
        return log_test("POST gerencia", False, "Request failed")
    
    if resp.status_code != 201:
        return log_test("POST gerencia", False, f"Expected 201, got {resp.status_code}: {resp.text}")
    
    data = resp.json()
    if "gerencia" not in data or "gerencia_id" not in data["gerencia"]:
        return log_test("POST gerencia", False, f"Missing gerencia or gerencia_id: {data}")
    
    return log_test("POST gerencia", True, f"Created gerencia: {data['gerencia']['nombre']}")

# ============================================================================
# PHASE 2: Authorization Tests for PUT/DELETE
# ============================================================================

def test_put_mandante_as_revisor():
    """Phase 2: PUT /api/mandantes/:id as revisor -> 403"""
    print("\n=== PHASE 2: PUT Mandante (revisor - should fail) ===")
    
    if not test_ids["mandante_id"]:
        return log_test("PUT mandante (revisor)", False, "No mandante ID available")
    
    resp = make_request("PUT", f"/mandantes/{test_ids['mandante_id']}", token=tokens["revisor"], data={
        "razon_social": "Unauthorized"
    })
    
    if not resp:
        return log_test("PUT mandante (revisor)", False, "Request failed")
    
    if resp.status_code == 403:
        return log_test("PUT mandante (revisor)", True, "Correctly rejected with 403")
    else:
        return log_test("PUT mandante (revisor)", False, f"Expected 403, got {resp.status_code}")

def test_put_contrato_as_mandante():
    """Phase 2: PUT /api/contratos/:id as mandante -> 403"""
    print("\n=== PHASE 2: PUT Contrato (mandante - should fail) ===")
    
    if not test_ids["contrato_id"]:
        return log_test("PUT contrato (mandante)", False, "No contrato ID available")
    
    resp = make_request("PUT", f"/contratos/{test_ids['contrato_id']}", token=tokens["mandante"], data={
        "estado": "vigente"
    })
    
    if not resp:
        return log_test("PUT contrato (mandante)", False, "Request failed")
    
    if resp.status_code == 403:
        return log_test("PUT contrato (mandante)", True, "Correctly rejected with 403")
    else:
        return log_test("PUT contrato (mandante)", False, f"Expected 403, got {resp.status_code}")

def test_put_trabajador_as_revisor():
    """Phase 2: PUT /api/trabajadores/:id as revisor -> 403"""
    print("\n=== PHASE 2: PUT Trabajador (revisor - should fail) ===")
    
    if not test_ids["trabajador_id"]:
        return log_test("PUT trabajador (revisor)", False, "No trabajador ID available")
    
    resp = make_request("PUT", f"/trabajadores/{test_ids['trabajador_id']}", token=tokens["revisor"], data={
        "cargo": "Unauthorized"
    })
    
    if not resp:
        return log_test("PUT trabajador (revisor)", False, "Request failed")
    
    if resp.status_code == 403:
        return log_test("PUT trabajador (revisor)", True, "Correctly rejected with 403")
    else:
        return log_test("PUT trabajador (revisor)", False, f"Expected 403, got {resp.status_code}")

def test_delete_trabajador_as_mandante():
    """Phase 2: DELETE /api/trabajadores/:id as mandante -> 403"""
    print("\n=== PHASE 2: DELETE Trabajador (mandante - should fail) ===")
    
    if not test_ids["trabajador_id"]:
        return log_test("DELETE trabajador (mandante)", False, "No trabajador ID available")
    
    resp = make_request("DELETE", f"/trabajadores/{test_ids['trabajador_id']}", token=tokens["mandante"])
    
    if not resp:
        return log_test("DELETE trabajador (mandante)", False, "Request failed")
    
    if resp.status_code == 403:
        return log_test("DELETE trabajador (mandante)", True, "Correctly rejected with 403")
    else:
        return log_test("DELETE trabajador (mandante)", False, f"Expected 403, got {resp.status_code}")

# ============================================================================
# MAIN
# ============================================================================

def main():
    """Run all Phase 2 tests"""
    print("=" * 80)
    print("APTIVA RL - PHASE 2 BACKEND API TESTS (PUT/DELETE + REGRESSION)")
    print("=" * 80)
    print(f"Base URL: {BASE_URL}")
    print("=" * 80)
    
    results = []
    
    # Regression Tests
    print("\n" + "=" * 80)
    print("REGRESSION TESTS")
    print("=" * 80)
    results.append(test_regression_login_all_users())
    results.append(test_regression_dashboard())
    results.append(test_regression_trabajador_acreditacion())
    
    # Phase 2 Tests
    print("\n" + "=" * 80)
    print("PHASE 2 NEW FEATURES")
    print("=" * 80)
    
    # Mandante detail with categorias
    results.append(test_mandante_detail_includes_categorias())
    
    # PUT /api/mandantes/:id
    results.append(test_put_mandante_as_admin())
    results.append(test_put_mandante_activo_false())
    results.append(test_put_mandante_as_mandante_user())
    
    # PUT /api/contratos/:id
    results.append(test_put_contrato_as_admin())
    
    # PUT /api/trabajadores/:id and DELETE
    results.append(test_put_trabajador_as_admin())
    results.append(test_delete_trabajador_as_admin())
    
    # Document standard management
    results.append(test_create_categoria())
    results.append(test_create_requisito())
    results.append(test_put_requisito())
    results.append(test_delete_requisito())
    
    # Mandante-empresa association
    results.append(test_create_mandante_empresa_association())
    results.append(test_delete_mandante_empresa_association())
    
    # Gerencias
    results.append(test_create_gerencia())
    
    # Authorization tests
    results.append(test_put_mandante_as_revisor())
    results.append(test_put_contrato_as_mandante())
    results.append(test_put_trabajador_as_revisor())
    results.append(test_delete_trabajador_as_mandante())
    
    # Summary
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    passed = sum(1 for r in results if r)
    total = len(results)
    print(f"Passed: {passed}/{total}")
    print(f"Failed: {total - passed}/{total}")
    
    if passed == total:
        print("\n🎉 ALL PHASE 2 TESTS PASSED!")
        return 0
    else:
        print(f"\n⚠️  {total - passed} TEST(S) FAILED")
        return 1

if __name__ == "__main__":
    sys.exit(main())
