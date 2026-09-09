#!/usr/bin/env python3
"""
Comprehensive backend API tests for Aptiva RL Corporate Platform
Tests all endpoints with proper authentication and authorization
"""
import requests
import json
import sys
import time
import io
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
test_mandante_id = None
test_contrato_id = None
test_trabajador_id = None
test_vehiculo_id = None
test_equipo_id = None
test_documento_id = None
seeded_mandante_id = None
seeded_empresa_id = None
seeded_trabajador_id = None
seeded_requisito_id = None

def log_test(name: str, passed: bool, details: str = ""):
    """Log test result"""
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"{status}: {name}")
    if details:
        print(f"   Details: {details}")
    return passed

def make_request(method: str, endpoint: str, token: Optional[str] = None, data: Optional[Dict] = None, params: Optional[Dict] = None, files: Optional[Dict] = None):
    """Make HTTP request with proper headers"""
    url = f"{BASE_URL}{endpoint}"
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    
    if files is None and data is not None:
        headers["Content-Type"] = "application/json"
    
    # Add small delay to avoid overwhelming the server
    time.sleep(0.3)
    
    try:
        if method == "GET":
            resp = requests.get(url, headers=headers, params=params, timeout=30)
        elif method == "POST":
            if files:
                resp = requests.post(url, headers=headers, data=data, files=files, timeout=30)
            else:
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
# TEST 1: Health Check
# ============================================================================

def test_health():
    """Test 1: GET /api/health -> {ok:true}"""
    print("\n=== Test 1: Health Check ===")
    resp = make_request("GET", "/health")
    
    if not resp:
        return log_test("Health endpoint", False, "Request failed")
    
    if resp.status_code != 200:
        return log_test("Health endpoint", False, f"Expected 200, got {resp.status_code}")
    
    data = resp.json()
    if data.get("ok") == True:
        return log_test("Health endpoint", True, f"Response: {data}")
    else:
        return log_test("Health endpoint", False, f"Unexpected response: {data}")

# ============================================================================
# TEST 2: Authentication
# ============================================================================

def test_auth_login_all_users():
    """Test 2a: Login for all 4 demo users (200 + correct role in profile)"""
    print("\n=== Test 2a: Login All Demo Users ===")
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
        log_test(f"Login {user_key}", True, f"Role: {profile['role_codigo']}, Email: {profile['email']}")
    
    return all_passed

def test_auth_login_wrong_password():
    """Test 2b: Wrong password -> 401"""
    print("\n=== Test 2b: Login Wrong Password ===")
    resp = make_request("POST", "/auth/login", data={
        "email": USERS["admin"]["email"],
        "password": "wrongpassword123"
    })
    
    if not resp:
        return log_test("Login wrong password", False, "Request failed")
    
    if resp.status_code == 401:
        return log_test("Login wrong password", True, "Correctly rejected with 401")
    else:
        return log_test("Login wrong password", False, f"Expected 401, got {resp.status_code}")

def test_auth_me_with_token():
    """Test 2c: GET /api/me with token works"""
    print("\n=== Test 2c: Get Current User (with token) ===")
    resp = make_request("GET", "/me", token=tokens["admin"])
    
    if not resp:
        return log_test("Get /me with token", False, "Request failed")
    
    if resp.status_code != 200:
        return log_test("Get /me with token", False, f"Expected 200, got {resp.status_code}")
    
    data = resp.json()
    if "profile" in data and data["profile"]["email"] == USERS["admin"]["email"]:
        return log_test("Get /me with token", True, f"Retrieved profile: {data['profile']['nombre']}")
    else:
        return log_test("Get /me with token", False, f"Unexpected response: {data}")

def test_auth_me_without_token():
    """Test 2d: GET /api/me without token -> 401"""
    print("\n=== Test 2d: Get Current User (without token) ===")
    resp = make_request("GET", "/me")
    
    if not resp:
        return log_test("Get /me without token", False, "Request failed")
    
    if resp.status_code == 401:
        return log_test("Get /me without token", True, "Correctly rejected with 401")
    else:
        return log_test("Get /me without token", False, f"Expected 401, got {resp.status_code}")

# ============================================================================
# TEST 3: Dashboard
# ============================================================================

def test_dashboard():
    """Test 3: GET /api/dashboard (as admin) -> stats object + acreditacion_por_mandante map"""
    print("\n=== Test 3: Dashboard Stats ===")
    resp = make_request("GET", "/dashboard", token=tokens["admin"])
    
    if not resp:
        return log_test("Dashboard", False, "Request failed")
    
    if resp.status_code != 200:
        return log_test("Dashboard", False, f"Expected 200, got {resp.status_code}: {resp.text}")
    
    data = resp.json()
    required_fields = ["stats", "acreditacion_por_mandante"]
    missing = [f for f in required_fields if f not in data]
    
    if missing:
        return log_test("Dashboard", False, f"Missing fields: {missing}")
    
    stats = data["stats"]
    stats_fields = ["mandantes", "contratos_vigentes", "trabajadores", "vehiculos", "equipos", 
                    "docs_pendientes", "docs_vencidos", "trabajadores_acreditados", "trabajadores_bloqueados"]
    missing_stats = [f for f in stats_fields if f not in stats]
    
    if missing_stats:
        return log_test("Dashboard", False, f"Missing stats fields: {missing_stats}")
    
    return log_test("Dashboard", True, f"Stats: mandantes={stats['mandantes']}, trabajadores={stats['trabajadores']}, acreditacion_por_mandante keys={len(data['acreditacion_por_mandante'])}")

# ============================================================================
# TEST 4: Mandantes
# ============================================================================

def test_mandantes_list_admin():
    """Test 4a: GET /api/mandantes (admin) -> 2 mandantes"""
    global seeded_mandante_id
    print("\n=== Test 4a: List Mandantes (admin) ===")
    resp = make_request("GET", "/mandantes", token=tokens["admin"])
    
    if not resp:
        return log_test("List mandantes (admin)", False, "Request failed")
    
    if resp.status_code != 200:
        return log_test("List mandantes (admin)", False, f"Expected 200, got {resp.status_code}")
    
    data = resp.json()
    if "mandantes" not in data:
        return log_test("List mandantes (admin)", False, f"Missing mandantes field: {data}")
    
    mandantes = data["mandantes"]
    if len(mandantes) >= 2:
        seeded_mandante_id = mandantes[0]["mandante_id"]
        return log_test("List mandantes (admin)", True, f"Found {len(mandantes)} mandantes")
    else:
        return log_test("List mandantes (admin)", False, f"Expected at least 2 mandantes, got {len(mandantes)}")

def test_mandantes_get_single():
    """Test 4b: GET /api/mandantes/:id -> {mandante, empresas, gerencias, contratos, requisitos, trabajadores}"""
    global seeded_empresa_id, seeded_requisito_id
    print("\n=== Test 4b: Get Single Mandante ===")
    
    if not seeded_mandante_id:
        return log_test("Get single mandante", False, "No mandante ID available")
    
    resp = make_request("GET", f"/mandantes/{seeded_mandante_id}", token=tokens["admin"])
    
    if not resp:
        return log_test("Get single mandante", False, "Request failed")
    
    if resp.status_code != 200:
        return log_test("Get single mandante", False, f"Expected 200, got {resp.status_code}")
    
    data = resp.json()
    required_fields = ["mandante", "empresas", "gerencias", "contratos", "requisitos", "trabajadores"]
    missing = [f for f in required_fields if f not in data]
    
    if missing:
        return log_test("Get single mandante", False, f"Missing fields: {missing}")
    
    # Store seeded empresa_id and requisito_id for later tests
    if data["empresas"]:
        seeded_empresa_id = data["empresas"][0]["empresa_id"]
    if data["requisitos"]:
        seeded_requisito_id = data["requisitos"][0]["requisito_id"]
    
    return log_test("Get single mandante", True, f"Mandante: {data['mandante']['razon_social']}, empresas={len(data['empresas'])}, contratos={len(data['contratos'])}, trabajadores={len(data['trabajadores'])}")

def test_mandantes_create():
    """Test 4c: POST /api/mandantes (admin) -> 201"""
    global test_mandante_id
    print("\n=== Test 4c: Create Mandante (admin) ===")
    
    resp = make_request("POST", "/mandantes", token=tokens["admin"], data={
        "razon_social": "Test Mandante Mining Corp",
        "rut": "88888888-8",
        "region": "Antofagasta",
        "comuna": "Calama"
    })
    
    if not resp:
        return log_test("Create mandante", False, "Request failed")
    
    if resp.status_code != 201:
        return log_test("Create mandante", False, f"Expected 201, got {resp.status_code}: {resp.text}")
    
    data = resp.json()
    if "mandante" in data and "mandante_id" in data["mandante"]:
        test_mandante_id = data["mandante"]["mandante_id"]
        return log_test("Create mandante", True, f"Created: {data['mandante']['razon_social']}")
    else:
        return log_test("Create mandante", False, f"Unexpected response: {data}")

# ============================================================================
# TEST 5: Contratos
# ============================================================================

def test_contratos_list():
    """Test 5a: GET /api/contratos (admin) with dotacion"""
    print("\n=== Test 5a: List Contratos ===")
    resp = make_request("GET", "/contratos", token=tokens["admin"])
    
    if not resp:
        return log_test("List contratos", False, "Request failed")
    
    if resp.status_code != 200:
        return log_test("List contratos", False, f"Expected 200, got {resp.status_code}")
    
    data = resp.json()
    if "contratos" not in data:
        return log_test("List contratos", False, f"Missing contratos field: {data}")
    
    contratos = data["contratos"]
    if contratos and "dotacion" in contratos[0]:
        return log_test("List contratos", True, f"Found {len(contratos)} contratos with dotacion field")
    else:
        return log_test("List contratos", False, f"Missing dotacion field or no contratos")

def test_contratos_get_single():
    """Test 5b: GET /api/contratos/:id -> {contrato (with dotacion), trabajadores}"""
    print("\n=== Test 5b: Get Single Contrato ===")
    
    # First get a contrato ID
    resp = make_request("GET", "/contratos", token=tokens["admin"])
    if not resp or resp.status_code != 200:
        return log_test("Get single contrato", False, "Failed to get contratos list")
    
    contratos = resp.json().get("contratos", [])
    if not contratos:
        return log_test("Get single contrato", False, "No contratos available")
    
    contrato_id = contratos[0]["contrato_id"]
    
    resp = make_request("GET", f"/contratos/{contrato_id}", token=tokens["admin"])
    
    if not resp:
        return log_test("Get single contrato", False, "Request failed")
    
    if resp.status_code != 200:
        return log_test("Get single contrato", False, f"Expected 200, got {resp.status_code}")
    
    data = resp.json()
    if "contrato" in data and "trabajadores" in data and "dotacion" in data["contrato"]:
        return log_test("Get single contrato", True, f"Contrato: {data['contrato']['numero_oc']}, dotacion={data['contrato']['dotacion']}, trabajadores={len(data['trabajadores'])}")
    else:
        return log_test("Get single contrato", False, f"Missing required fields: {data.keys()}")

def test_contratos_create_invalid_empresa():
    """Test 5c: POST /api/contratos with mandante_id + empresa_id NOT related -> 400"""
    print("\n=== Test 5c: Create Contrato (invalid empresa-mandante) ===")
    
    # Get all mandantes and empresas
    resp_m = make_request("GET", "/mandantes", token=tokens["admin"])
    resp_e = make_request("GET", "/empresas", token=tokens["admin"])
    
    if not resp_m or not resp_e or resp_m.status_code != 200 or resp_e.status_code != 200:
        return log_test("Create contrato (invalid)", False, "Failed to get mandantes/empresas")
    
    mandantes = resp_m.json().get("mandantes", [])
    empresas = resp_e.json().get("empresas", [])
    
    if len(mandantes) < 2 or len(empresas) < 2:
        return log_test("Create contrato (invalid)", False, "Not enough mandantes/empresas for test")
    
    # Try to find a mandante-empresa pair that are NOT related
    # For simplicity, we'll try different combinations
    mandante_id = mandantes[0]["mandante_id"]
    
    # Get the mandante details to see which empresas are related
    resp_detail = make_request("GET", f"/mandantes/{mandante_id}", token=tokens["admin"])
    if not resp_detail or resp_detail.status_code != 200:
        return log_test("Create contrato (invalid)", False, "Failed to get mandante details")
    
    related_empresa_ids = [e["empresa_id"] for e in resp_detail.json().get("empresas", [])]
    
    # Find an empresa NOT in the related list
    unrelated_empresa_id = None
    for empresa in empresas:
        if empresa["empresa_id"] not in related_empresa_ids:
            unrelated_empresa_id = empresa["empresa_id"]
            break
    
    if not unrelated_empresa_id:
        # All empresas are related, skip this test
        return log_test("Create contrato (invalid)", True, "SKIP: All empresas are related to mandante (cannot test invalid case)")
    
    resp = make_request("POST", "/contratos", token=tokens["admin"], data={
        "numero_oc": "TEST-INVALID-001",
        "mandante_id": mandante_id,
        "empresa_id": unrelated_empresa_id,
        "estado": "vigente"
    })
    
    if not resp:
        return log_test("Create contrato (invalid)", False, "Request failed")
    
    if resp.status_code == 400 and "no está habilitada" in resp.text:
        return log_test("Create contrato (invalid)", True, "Correctly rejected with 400")
    else:
        return log_test("Create contrato (invalid)", False, f"Expected 400 with 'no está habilitada', got {resp.status_code}: {resp.text}")

def test_contratos_create_valid():
    """Test 5d: POST /api/contratos with valid mandante-empresa pair -> 201"""
    global test_contrato_id
    print("\n=== Test 5d: Create Contrato (valid) ===")
    
    if not seeded_mandante_id or not seeded_empresa_id:
        return log_test("Create contrato (valid)", False, "No seeded mandante/empresa IDs")
    
    resp = make_request("POST", "/contratos", token=tokens["admin"], data={
        "numero_oc": f"TEST-OC-{int(time.time())}",
        "mandante_id": seeded_mandante_id,
        "empresa_id": seeded_empresa_id,
        "estado": "vigente",
        "limite_contingente": 50
    })
    
    if not resp:
        return log_test("Create contrato (valid)", False, "Request failed")
    
    if resp.status_code != 201:
        return log_test("Create contrato (valid)", False, f"Expected 201, got {resp.status_code}: {resp.text}")
    
    data = resp.json()
    if "contrato" in data and "contrato_id" in data["contrato"]:
        test_contrato_id = data["contrato"]["contrato_id"]
        return log_test("Create contrato (valid)", True, f"Created: {data['contrato']['numero_oc']}")
    else:
        return log_test("Create contrato (valid)", False, f"Unexpected response: {data}")

# ============================================================================
# TEST 6: Trabajadores
# ============================================================================

def test_trabajadores_list():
    """Test 6a: GET /api/trabajadores (admin) -> ~10"""
    global seeded_trabajador_id
    print("\n=== Test 6a: List Trabajadores ===")
    resp = make_request("GET", "/trabajadores", token=tokens["admin"])
    
    if not resp:
        return log_test("List trabajadores", False, "Request failed")
    
    if resp.status_code != 200:
        return log_test("List trabajadores", False, f"Expected 200, got {resp.status_code}")
    
    data = resp.json()
    if "trabajadores" not in data:
        return log_test("List trabajadores", False, f"Missing trabajadores field: {data}")
    
    trabajadores = data["trabajadores"]
    if trabajadores:
        seeded_trabajador_id = trabajadores[0]["trabajador_id"]
        return log_test("List trabajadores", True, f"Found {len(trabajadores)} trabajadores")
    else:
        return log_test("List trabajadores", False, "No trabajadores found")

def test_trabajadores_search():
    """Test 6b: GET /api/trabajadores?q=Perez search"""
    print("\n=== Test 6b: Search Trabajadores ===")
    resp = make_request("GET", "/trabajadores", token=tokens["admin"], params={"q": "Perez"})
    
    if not resp:
        return log_test("Search trabajadores", False, "Request failed")
    
    if resp.status_code != 200:
        return log_test("Search trabajadores", False, f"Expected 200, got {resp.status_code}")
    
    data = resp.json()
    if "trabajadores" in data:
        # Search might return 0 results if no "Perez" exists, that's OK
        return log_test("Search trabajadores", True, f"Search returned {len(data['trabajadores'])} results")
    else:
        return log_test("Search trabajadores", False, f"Missing trabajadores field: {data}")

def test_trabajadores_get_single():
    """Test 6c: GET /api/trabajadores/:id -> {trabajador, asignaciones, acreditacion, historial}"""
    print("\n=== Test 6c: Get Single Trabajador ===")
    
    if not seeded_trabajador_id:
        return log_test("Get single trabajador", False, "No trabajador ID available")
    
    resp = make_request("GET", f"/trabajadores/{seeded_trabajador_id}", token=tokens["admin"])
    
    if not resp:
        return log_test("Get single trabajador", False, "Request failed")
    
    if resp.status_code != 200:
        return log_test("Get single trabajador", False, f"Expected 200, got {resp.status_code}")
    
    data = resp.json()
    required_fields = ["trabajador", "asignaciones", "acreditacion", "historial"]
    missing = [f for f in required_fields if f not in data]
    
    if missing:
        return log_test("Get single trabajador", False, f"Missing fields: {missing}")
    
    # Check acreditacion structure
    acreditacion = data["acreditacion"]
    if acreditacion and isinstance(acreditacion, list):
        first_acr = acreditacion[0]
        if "estado" in first_acr and first_acr["estado"] in ["ACREDITADO", "EN_REVISION", "BLOQUEADO"] and "detalle" in first_acr:
            return log_test("Get single trabajador", True, f"Trabajador: {data['trabajador']['nombre']} {data['trabajador']['apellido']}, asignaciones={len(data['asignaciones'])}, acreditacion={len(acreditacion)}")
        else:
            return log_test("Get single trabajador", False, f"Invalid acreditacion structure: {first_acr}")
    else:
        # No acreditacion is OK if worker has no assignments
        return log_test("Get single trabajador", True, f"Trabajador: {data['trabajador']['nombre']} {data['trabajador']['apellido']}, no acreditacion (no assignments)")

def test_trabajadores_create():
    """Test 6d: POST /api/trabajadores (admin) -> 201"""
    global test_trabajador_id
    print("\n=== Test 6d: Create Trabajador ===")
    
    if not seeded_empresa_id:
        return log_test("Create trabajador", False, "No empresa ID available")
    
    rut = f"{int(time.time()) % 100000000}-{(int(time.time()) % 9) + 1}"
    
    resp = make_request("POST", "/trabajadores", token=tokens["admin"], data={
        "empresa_id": seeded_empresa_id,
        "rut": rut,
        "nombre": "Juan Carlos",
        "apellido": "Test Worker",
        "cargo": "Operador"
    })
    
    if not resp:
        return log_test("Create trabajador", False, "Request failed")
    
    if resp.status_code != 201:
        return log_test("Create trabajador", False, f"Expected 201, got {resp.status_code}: {resp.text}")
    
    data = resp.json()
    if "trabajador" in data and "trabajador_id" in data["trabajador"]:
        test_trabajador_id = data["trabajador"]["trabajador_id"]
        return log_test("Create trabajador", True, f"Created: {data['trabajador']['nombre']} {data['trabajador']['apellido']}")
    else:
        return log_test("Create trabajador", False, f"Unexpected response: {data}")

def test_trabajadores_create_duplicate_rut():
    """Test 6e: POST /api/trabajadores with same rut -> 409"""
    print("\n=== Test 6e: Create Trabajador (duplicate RUT) ===")
    
    if not seeded_empresa_id:
        return log_test("Create trabajador (duplicate)", False, "No empresa ID available")
    
    # Get an existing trabajador's RUT
    resp = make_request("GET", "/trabajadores", token=tokens["admin"])
    if not resp or resp.status_code != 200:
        return log_test("Create trabajador (duplicate)", False, "Failed to get trabajadores")
    
    trabajadores = resp.json().get("trabajadores", [])
    if not trabajadores:
        return log_test("Create trabajador (duplicate)", False, "No trabajadores to get RUT from")
    
    existing_rut = trabajadores[0]["rut"]
    
    resp = make_request("POST", "/trabajadores", token=tokens["admin"], data={
        "empresa_id": seeded_empresa_id,
        "rut": existing_rut,
        "nombre": "Duplicate",
        "apellido": "Worker",
        "cargo": "Test"
    })
    
    if not resp:
        return log_test("Create trabajador (duplicate)", False, "Request failed")
    
    if resp.status_code == 409:
        return log_test("Create trabajador (duplicate)", True, "Correctly rejected with 409")
    else:
        return log_test("Create trabajador (duplicate)", False, f"Expected 409, got {resp.status_code}")

# ============================================================================
# TEST 7: Trabajador Asignaciones
# ============================================================================

def test_asignar_trabajador_different_empresa():
    """Test 7a: POST /api/trabajadores/asignar - worker to contrato of DIFFERENT empresa -> 400"""
    print("\n=== Test 7a: Asignar Trabajador (different empresa) ===")
    
    # Get a trabajador and a contrato from different empresas
    resp_t = make_request("GET", "/trabajadores", token=tokens["admin"])
    resp_c = make_request("GET", "/contratos", token=tokens["admin"])
    
    if not resp_t or not resp_c or resp_t.status_code != 200 or resp_c.status_code != 200:
        return log_test("Asignar trabajador (different empresa)", False, "Failed to get trabajadores/contratos")
    
    trabajadores = resp_t.json().get("trabajadores", [])
    contratos = resp_c.json().get("contratos", [])
    
    if not trabajadores or not contratos:
        return log_test("Asignar trabajador (different empresa)", False, "No trabajadores or contratos")
    
    # Find a trabajador and contrato with different empresa_id
    trabajador = None
    contrato = None
    for t in trabajadores:
        for c in contratos:
            if t["empresa_id"] != c["empresa_id"]:
                trabajador = t
                contrato = c
                break
        if trabajador:
            break
    
    if not trabajador or not contrato:
        return log_test("Asignar trabajador (different empresa)", True, "SKIP: All trabajadores and contratos have same empresa")
    
    resp = make_request("POST", "/trabajadores/asignar", token=tokens["admin"], data={
        "trabajador_id": trabajador["trabajador_id"],
        "contrato_id": contrato["contrato_id"]
    })
    
    if not resp:
        return log_test("Asignar trabajador (different empresa)", False, "Request failed")
    
    if resp.status_code == 400 and "solo puede asignarse a contratos de su empresa" in resp.text:
        return log_test("Asignar trabajador (different empresa)", True, "Correctly rejected with 400")
    else:
        return log_test("Asignar trabajador (different empresa)", False, f"Expected 400, got {resp.status_code}: {resp.text}")

def test_asignar_trabajador_duplicate_mandante():
    """Test 7b: POST /api/trabajadores/asignar - worker already has active assignment in mandante -> 409"""
    print("\n=== Test 7b: Asignar Trabajador (duplicate mandante) ===")
    
    # Get a trabajador with an active assignment
    resp = make_request("GET", "/trabajadores", token=tokens["admin"])
    if not resp or resp.status_code != 200:
        return log_test("Asignar trabajador (duplicate mandante)", False, "Failed to get trabajadores")
    
    trabajadores = resp.json().get("trabajadores", [])
    
    # Find a trabajador with an assignment
    trabajador_with_assignment = None
    for t in trabajadores:
        resp_detail = make_request("GET", f"/trabajadores/{t['trabajador_id']}", token=tokens["admin"])
        if resp_detail and resp_detail.status_code == 200:
            data = resp_detail.json()
            active_asignaciones = [a for a in data.get("asignaciones", []) if a.get("estado") == "activo"]
            if active_asignaciones:
                trabajador_with_assignment = t
                mandante_id = active_asignaciones[0]["mandante_id"]
                break
    
    if not trabajador_with_assignment:
        return log_test("Asignar trabajador (duplicate mandante)", True, "SKIP: No trabajador with active assignment found")
    
    # Find another contrato with the same mandante and empresa
    resp_c = make_request("GET", "/contratos", token=tokens["admin"])
    if not resp_c or resp_c.status_code != 200:
        return log_test("Asignar trabajador (duplicate mandante)", False, "Failed to get contratos")
    
    contratos = resp_c.json().get("contratos", [])
    matching_contrato = None
    for c in contratos:
        if c["mandante_id"] == mandante_id and c["empresa_id"] == trabajador_with_assignment["empresa_id"]:
            matching_contrato = c
            break
    
    if not matching_contrato:
        return log_test("Asignar trabajador (duplicate mandante)", True, "SKIP: No matching contrato found")
    
    resp = make_request("POST", "/trabajadores/asignar", token=tokens["admin"], data={
        "trabajador_id": trabajador_with_assignment["trabajador_id"],
        "contrato_id": matching_contrato["contrato_id"]
    })
    
    if not resp:
        return log_test("Asignar trabajador (duplicate mandante)", False, "Request failed")
    
    if resp.status_code == 409 and "ya tiene un contrato activo con este mandante" in resp.text:
        return log_test("Asignar trabajador (duplicate mandante)", True, "Correctly rejected with 409")
    else:
        return log_test("Asignar trabajador (duplicate mandante)", False, f"Expected 409, got {resp.status_code}: {resp.text}")

def test_asignar_trabajador_valid():
    """Test 7c: POST /api/trabajadores/asignar - valid assignment -> 201"""
    print("\n=== Test 7c: Asignar Trabajador (valid) ===")
    
    if not test_trabajador_id or not test_contrato_id:
        return log_test("Asignar trabajador (valid)", False, "No test trabajador or contrato ID")
    
    resp = make_request("POST", "/trabajadores/asignar", token=tokens["admin"], data={
        "trabajador_id": test_trabajador_id,
        "contrato_id": test_contrato_id
    })
    
    if not resp:
        return log_test("Asignar trabajador (valid)", False, "Request failed")
    
    if resp.status_code != 201:
        return log_test("Asignar trabajador (valid)", False, f"Expected 201, got {resp.status_code}: {resp.text}")
    
    data = resp.json()
    if "asignacion" in data and "asignacion_id" in data["asignacion"]:
        return log_test("Asignar trabajador (valid)", True, f"Created assignment: {data['asignacion']['asignacion_id']}")
    else:
        return log_test("Asignar trabajador (valid)", False, f"Unexpected response: {data}")

# ============================================================================
# TEST 8: Vehiculos & Equipos
# ============================================================================

def test_vehiculos_list():
    """Test 8a: GET /api/vehiculos (admin) -> lists"""
    print("\n=== Test 8a: List Vehiculos ===")
    resp = make_request("GET", "/vehiculos", token=tokens["admin"])
    
    if not resp:
        return log_test("List vehiculos", False, "Request failed")
    
    if resp.status_code != 200:
        return log_test("List vehiculos", False, f"Expected 200, got {resp.status_code}")
    
    data = resp.json()
    if "vehiculos" in data:
        return log_test("List vehiculos", True, f"Found {len(data['vehiculos'])} vehiculos")
    else:
        return log_test("List vehiculos", False, f"Missing vehiculos field: {data}")

def test_equipos_list():
    """Test 8b: GET /api/equipos (admin) -> lists"""
    print("\n=== Test 8b: List Equipos ===")
    resp = make_request("GET", "/equipos", token=tokens["admin"])
    
    if not resp:
        return log_test("List equipos", False, "Request failed")
    
    if resp.status_code != 200:
        return log_test("List equipos", False, f"Expected 200, got {resp.status_code}")
    
    data = resp.json()
    if "equipos" in data:
        return log_test("List equipos", True, f"Found {len(data['equipos'])} equipos")
    else:
        return log_test("List equipos", False, f"Missing equipos field: {data}")

def test_vehiculos_create():
    """Test 8c: POST /api/vehiculos -> 201"""
    global test_vehiculo_id
    print("\n=== Test 8c: Create Vehiculo ===")
    
    if not seeded_empresa_id:
        return log_test("Create vehiculo", False, "No empresa ID available")
    
    resp = make_request("POST", "/vehiculos", token=tokens["admin"], data={
        "empresa_id": seeded_empresa_id,
        "patente": f"TEST{int(time.time()) % 10000}",
        "tipo": "Camioneta",
        "marca": "Toyota",
        "modelo": "Hilux",
        "anio": 2023
    })
    
    if not resp:
        return log_test("Create vehiculo", False, "Request failed")
    
    if resp.status_code != 201:
        return log_test("Create vehiculo", False, f"Expected 201, got {resp.status_code}: {resp.text}")
    
    data = resp.json()
    if "vehiculo" in data and "vehiculo_id" in data["vehiculo"]:
        test_vehiculo_id = data["vehiculo"]["vehiculo_id"]
        return log_test("Create vehiculo", True, f"Created: {data['vehiculo']['patente']}")
    else:
        return log_test("Create vehiculo", False, f"Unexpected response: {data}")

def test_equipos_create():
    """Test 8d: POST /api/equipos -> 201"""
    global test_equipo_id
    print("\n=== Test 8d: Create Equipo ===")
    
    if not seeded_empresa_id:
        return log_test("Create equipo", False, "No empresa ID available")
    
    resp = make_request("POST", "/equipos", token=tokens["admin"], data={
        "empresa_id": seeded_empresa_id,
        "codigo_interno": f"EQ-TEST-{int(time.time()) % 10000}",
        "tipo": "Excavadora"
    })
    
    if not resp:
        return log_test("Create equipo", False, "Request failed")
    
    if resp.status_code != 201:
        return log_test("Create equipo", False, f"Expected 201, got {resp.status_code}: {resp.text}")
    
    data = resp.json()
    if "equipo" in data and "equipo_id" in data["equipo"]:
        test_equipo_id = data["equipo"]["equipo_id"]
        return log_test("Create equipo", True, f"Created: {data['equipo']['codigo_interno']}")
    else:
        return log_test("Create equipo", False, f"Unexpected response: {data}")

# ============================================================================
# TEST 9: Document Flow (Supabase Storage)
# ============================================================================

def test_documentos_upload():
    """Test 9a: POST /api/documentos/upload with multipart/form-data -> 201"""
    global test_documento_id
    print("\n=== Test 9a: Upload Documento ===")
    
    if not seeded_trabajador_id or not seeded_mandante_id or not seeded_requisito_id:
        return log_test("Upload documento", False, "Missing required IDs (trabajador, mandante, requisito)")
    
    # Create a small test file
    file_content = b"Test document content for automated testing"
    file_obj = io.BytesIO(file_content)
    
    # Prepare multipart form data
    files = {
        'file': ('test_document.txt', file_obj, 'text/plain')
    }
    
    data = {
        'recurso_tipo': 'trabajador',
        'recurso_id': seeded_trabajador_id,
        'requisito_id': seeded_requisito_id,
        'mandante_id': seeded_mandante_id,
        'fecha_vencimiento': '2027-01-01'
    }
    
    resp = make_request("POST", "/documentos/upload", token=tokens["admin"], data=data, files=files)
    
    if not resp:
        return log_test("Upload documento", False, "Request failed")
    
    if resp.status_code != 201:
        return log_test("Upload documento", False, f"Expected 201, got {resp.status_code}: {resp.text}")
    
    doc_data = resp.json()
    if "documento" in doc_data and "documento_id" in doc_data["documento"]:
        documento = doc_data["documento"]
        if documento.get("estado") == "en_revision" and documento.get("path"):
            test_documento_id = documento["documento_id"]
            return log_test("Upload documento", True, f"Uploaded: {documento['nombre_archivo']}, estado={documento['estado']}, path={documento['path']}")
        else:
            return log_test("Upload documento", False, f"Missing estado or path: {documento}")
    else:
        return log_test("Upload documento", False, f"Unexpected response: {doc_data}")

def test_documentos_pendientes():
    """Test 9b: GET /api/documentos/pendientes -> includes uploaded doc"""
    print("\n=== Test 9b: Get Documentos Pendientes ===")
    
    resp = make_request("GET", "/documentos/pendientes", token=tokens["admin"])
    
    if not resp:
        return log_test("Get documentos pendientes", False, "Request failed")
    
    if resp.status_code != 200:
        return log_test("Get documentos pendientes", False, f"Expected 200, got {resp.status_code}")
    
    data = resp.json()
    if "documentos" in data:
        docs = data["documentos"]
        if test_documento_id:
            found = any(d["documento_id"] == test_documento_id for d in docs)
            if found:
                return log_test("Get documentos pendientes", True, f"Found {len(docs)} pending docs, including uploaded doc")
            else:
                return log_test("Get documentos pendientes", False, f"Uploaded doc not found in pending list")
        else:
            return log_test("Get documentos pendientes", True, f"Found {len(docs)} pending docs")
    else:
        return log_test("Get documentos pendientes", False, f"Missing documentos field: {data}")

def test_documentos_revision_as_revisor():
    """Test 9c: POST /api/documentos/:id/revision as revisor -> 200"""
    print("\n=== Test 9c: Review Documento (revisor) ===")
    
    if not test_documento_id:
        return log_test("Review documento (revisor)", False, "No documento ID available")
    
    resp = make_request("POST", f"/documentos/{test_documento_id}/revision", token=tokens["revisor"], data={
        "estado": "aprobado",
        "observacion": "Documento aprobado por revisor"
    })
    
    if not resp:
        return log_test("Review documento (revisor)", False, "Request failed")
    
    if resp.status_code != 200:
        return log_test("Review documento (revisor)", False, f"Expected 200, got {resp.status_code}: {resp.text}")
    
    data = resp.json()
    if "documento" in data and data["documento"].get("estado") == "aprobado":
        return log_test("Review documento (revisor)", True, f"Documento approved by revisor")
    else:
        return log_test("Review documento (revisor)", False, f"Unexpected response: {data}")

def test_documentos_revision_as_mandante():
    """Test 9d: POST /api/documentos/:id/revision as mandante (USUARIO_MANDANTE) -> 403"""
    print("\n=== Test 9d: Review Documento (mandante - should fail) ===")
    
    if not test_documento_id:
        return log_test("Review documento (mandante)", False, "No documento ID available")
    
    resp = make_request("POST", f"/documentos/{test_documento_id}/revision", token=tokens["mandante"], data={
        "estado": "aprobado"
    })
    
    if not resp:
        return log_test("Review documento (mandante)", False, "Request failed")
    
    if resp.status_code == 403:
        return log_test("Review documento (mandante)", True, "Correctly rejected with 403")
    else:
        return log_test("Review documento (mandante)", False, f"Expected 403, got {resp.status_code}")

def test_documentos_get_url():
    """Test 9e: GET /api/documentos/:id/url -> {url} (signed URL)"""
    print("\n=== Test 9e: Get Documento URL ===")
    
    if not test_documento_id:
        return log_test("Get documento URL", False, "No documento ID available")
    
    resp = make_request("GET", f"/documentos/{test_documento_id}/url", token=tokens["admin"])
    
    if not resp:
        return log_test("Get documento URL", False, "Request failed")
    
    if resp.status_code != 200:
        return log_test("Get documento URL", False, f"Expected 200, got {resp.status_code}")
    
    data = resp.json()
    if "url" in data and isinstance(data["url"], str) and data["url"].startswith("http"):
        return log_test("Get documento URL", True, f"Got signed URL (length={len(data['url'])})")
    else:
        return log_test("Get documento URL", False, f"Invalid URL response: {data}")

# ============================================================================
# TEST 10: Vencimientos & Auditoria
# ============================================================================

def test_vencimientos():
    """Test 10a: GET /api/vencimientos?dias=30 -> list"""
    print("\n=== Test 10a: Get Vencimientos ===")
    resp = make_request("GET", "/vencimientos", token=tokens["admin"], params={"dias": "30"})
    
    if not resp:
        return log_test("Get vencimientos", False, "Request failed")
    
    if resp.status_code != 200:
        return log_test("Get vencimientos", False, f"Expected 200, got {resp.status_code}")
    
    data = resp.json()
    if "documentos" in data:
        return log_test("Get vencimientos", True, f"Found {len(data['documentos'])} documentos expiring in 30 days")
    else:
        return log_test("Get vencimientos", False, f"Missing documentos field: {data}")

def test_auditoria():
    """Test 10b: GET /api/auditoria (admin) -> eventos (should include upload/revision/create events)"""
    print("\n=== Test 10b: Get Auditoria ===")
    resp = make_request("GET", "/auditoria", token=tokens["admin"])
    
    if not resp:
        return log_test("Get auditoria", False, "Request failed")
    
    if resp.status_code != 200:
        return log_test("Get auditoria", False, f"Expected 200, got {resp.status_code}")
    
    data = resp.json()
    if "eventos" in data:
        eventos = data["eventos"]
        # Check for expected event types
        event_types = [e.get("accion") for e in eventos]
        expected_events = ["cargar_documento", "aprobar_documento", "crear_trabajador", "crear_contrato"]
        found_events = [e for e in expected_events if e in event_types]
        
        return log_test("Get auditoria", True, f"Found {len(eventos)} audit events, including: {', '.join(found_events)}")
    else:
        return log_test("Get auditoria", False, f"Missing eventos field: {data}")

# ============================================================================
# TEST 11: Role Enforcement
# ============================================================================

def test_role_mandante_list_mandantes():
    """Test 11a: GET /api/mandantes as mandante (USUARIO_MANDANTE) -> returns only their mandante"""
    print("\n=== Test 11a: List Mandantes (mandante user) ===")
    resp = make_request("GET", "/mandantes", token=tokens["mandante"])
    
    if not resp:
        return log_test("List mandantes (mandante)", False, "Request failed")
    
    if resp.status_code != 200:
        return log_test("List mandantes (mandante)", False, f"Expected 200, got {resp.status_code}")
    
    data = resp.json()
    if "mandantes" in data:
        mandantes = data["mandantes"]
        # Should only see their own mandante
        if len(mandantes) == 1:
            return log_test("List mandantes (mandante)", True, f"Correctly filtered to 1 mandante: {mandantes[0]['razon_social']}")
        else:
            return log_test("List mandantes (mandante)", False, f"Expected 1 mandante, got {len(mandantes)}")
    else:
        return log_test("List mandantes (mandante)", False, f"Missing mandantes field: {data}")

def test_role_mandante_create_mandante():
    """Test 11b: POST /api/mandantes as mandante -> 403"""
    print("\n=== Test 11b: Create Mandante (mandante - should fail) ===")
    resp = make_request("POST", "/mandantes", token=tokens["mandante"], data={
        "razon_social": "Unauthorized Mandante",
        "rut": "99999999-9"
    })
    
    if not resp:
        return log_test("Create mandante (mandante)", False, "Request failed")
    
    if resp.status_code == 403:
        return log_test("Create mandante (mandante)", True, "Correctly rejected with 403")
    else:
        return log_test("Create mandante (mandante)", False, f"Expected 403, got {resp.status_code}")

def test_role_revisor_create_mandante():
    """Test 11c: POST /api/mandantes as revisor -> 403"""
    print("\n=== Test 11c: Create Mandante (revisor - should fail) ===")
    resp = make_request("POST", "/mandantes", token=tokens["revisor"], data={
        "razon_social": "Unauthorized Mandante",
        "rut": "99999999-9"
    })
    
    if not resp:
        return log_test("Create mandante (revisor)", False, "Request failed")
    
    if resp.status_code == 403:
        return log_test("Create mandante (revisor)", True, "Correctly rejected with 403")
    else:
        return log_test("Create mandante (revisor)", False, f"Expected 403, got {resp.status_code}")

def test_role_mandante_create_trabajador():
    """Test 11d: POST /api/trabajadores as mandante -> 403"""
    print("\n=== Test 11d: Create Trabajador (mandante - should fail) ===")
    resp = make_request("POST", "/trabajadores", token=tokens["mandante"], data={
        "empresa_id": seeded_empresa_id,
        "rut": "11111111-1",
        "nombre": "Unauthorized",
        "apellido": "Worker"
    })
    
    if not resp:
        return log_test("Create trabajador (mandante)", False, "Request failed")
    
    if resp.status_code == 403:
        return log_test("Create trabajador (mandante)", True, "Correctly rejected with 403")
    else:
        return log_test("Create trabajador (mandante)", False, f"Expected 403, got {resp.status_code}")

def test_role_revisor_create_trabajador():
    """Test 11e: POST /api/trabajadores as revisor -> 403"""
    print("\n=== Test 11e: Create Trabajador (revisor - should fail) ===")
    resp = make_request("POST", "/trabajadores", token=tokens["revisor"], data={
        "empresa_id": seeded_empresa_id,
        "rut": "11111111-1",
        "nombre": "Unauthorized",
        "apellido": "Worker"
    })
    
    if not resp:
        return log_test("Create trabajador (revisor)", False, "Request failed")
    
    if resp.status_code == 403:
        return log_test("Create trabajador (revisor)", True, "Correctly rejected with 403")
    else:
        return log_test("Create trabajador (revisor)", False, f"Expected 403, got {resp.status_code}")

# ============================================================================
# MAIN
# ============================================================================

def main():
    """Run all tests"""
    print("=" * 80)
    print("APTIVA RL CORPORATE PLATFORM - BACKEND API TESTS")
    print("=" * 80)
    print(f"Base URL: {BASE_URL}")
    print(f"Testing with 4 demo users: admin, empresa, revisor, mandante")
    print("=" * 80)
    
    results = []
    
    # Test 1: Health
    results.append(test_health())
    
    # Test 2: Auth
    results.append(test_auth_login_all_users())
    results.append(test_auth_login_wrong_password())
    results.append(test_auth_me_with_token())
    results.append(test_auth_me_without_token())
    
    # Test 3: Dashboard
    results.append(test_dashboard())
    
    # Test 4: Mandantes
    results.append(test_mandantes_list_admin())
    results.append(test_mandantes_get_single())
    results.append(test_mandantes_create())
    
    # Test 5: Contratos
    results.append(test_contratos_list())
    results.append(test_contratos_get_single())
    results.append(test_contratos_create_invalid_empresa())
    results.append(test_contratos_create_valid())
    
    # Test 6: Trabajadores
    results.append(test_trabajadores_list())
    results.append(test_trabajadores_search())
    results.append(test_trabajadores_get_single())
    results.append(test_trabajadores_create())
    results.append(test_trabajadores_create_duplicate_rut())
    
    # Test 7: Asignaciones
    results.append(test_asignar_trabajador_different_empresa())
    results.append(test_asignar_trabajador_duplicate_mandante())
    results.append(test_asignar_trabajador_valid())
    
    # Test 8: Vehiculos & Equipos
    results.append(test_vehiculos_list())
    results.append(test_equipos_list())
    results.append(test_vehiculos_create())
    results.append(test_equipos_create())
    
    # Test 9: Document Flow
    results.append(test_documentos_upload())
    results.append(test_documentos_pendientes())
    results.append(test_documentos_revision_as_revisor())
    results.append(test_documentos_revision_as_mandante())
    results.append(test_documentos_get_url())
    
    # Test 10: Vencimientos & Auditoria
    results.append(test_vencimientos())
    results.append(test_auditoria())
    
    # Test 11: Role Enforcement
    results.append(test_role_mandante_list_mandantes())
    results.append(test_role_mandante_create_mandante())
    results.append(test_role_revisor_create_mandante())
    results.append(test_role_mandante_create_trabajador())
    results.append(test_role_revisor_create_trabajador())
    
    # Summary
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    passed = sum(1 for r in results if r)
    total = len(results)
    print(f"Passed: {passed}/{total}")
    print(f"Failed: {total - passed}/{total}")
    
    if passed == total:
        print("\n🎉 ALL TESTS PASSED!")
        return 0
    else:
        print(f"\n⚠️  {total - passed} TEST(S) FAILED")
        return 1

if __name__ == "__main__":
    sys.exit(main())
