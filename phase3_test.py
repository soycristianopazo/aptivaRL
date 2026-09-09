#!/usr/bin/env python3
"""
Phase 3 Backend Tests for Aptiva RL
Tests vehiculos & equipos with assignments + documental accreditation
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
    "mandante": {"email": "mandante@aptivarl.com", "password": "Aptiva2025!", "role": "USUARIO_MANDANTE"}
}

# Test state
tokens = {}
profiles = {}
vehiculo_data = None
equipo_data = None
contrato_data = None

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
        
        # Print response details for debugging
        if resp.status_code >= 400:
            print(f"   DEBUG: {method} {url} -> {resp.status_code}")
            try:
                print(f"   DEBUG: Response: {resp.text[:200]}")
            except:
                pass
        
        return resp
    except Exception as e:
        print(f"   ⚠️  Request error: {str(e)}")
        import traceback
        traceback.print_exc()
        return None

# ============================================================================
# SETUP: Login
# ============================================================================

def setup_auth():
    """Login all users"""
    print("\n=== SETUP: Authentication ===")
    for role, user in USERS.items():
        resp = make_request("POST", "/auth/login", data={"email": user["email"], "password": user["password"]})
        if resp and resp.status_code == 200:
            data = resp.json()
            tokens[role] = data.get("token")
            profiles[role] = data.get("profile")
            print(f"✅ Logged in as {role}: {user['email']}")
        else:
            print(f"❌ Failed to login as {role}")
            return False
    return True

# ============================================================================
# TEST 1: GET /api/vehiculos (admin) -> list (>=4)
# ============================================================================

def test_vehiculos_list():
    """Test 1: GET /api/vehiculos returns list with >=4 vehiculos"""
    print("\n=== Test 1: GET /api/vehiculos (list) ===")
    global vehiculo_data
    
    resp = make_request("GET", "/vehiculos", token=tokens["admin"])
    
    if not resp:
        return log_test("GET /api/vehiculos", False, "Request failed")
    
    if resp.status_code != 200:
        return log_test("GET /api/vehiculos", False, f"Expected 200, got {resp.status_code}")
    
    data = resp.json()
    vehiculos = data.get("vehiculos", [])
    
    if len(vehiculos) < 4:
        return log_test("GET /api/vehiculos", False, f"Expected >=4 vehiculos, got {len(vehiculos)}")
    
    # Store first vehiculo for later tests
    vehiculo_data = vehiculos[0]
    
    return log_test("GET /api/vehiculos", True, f"Found {len(vehiculos)} vehiculos")

# ============================================================================
# TEST 2: GET /api/vehiculos/:id -> {recurso, asignaciones, acreditacion}
# ============================================================================

def test_vehiculos_detail():
    """Test 2: GET /api/vehiculos/:id returns recurso with asignaciones and acreditacion"""
    print("\n=== Test 2: GET /api/vehiculos/:id (detail) ===")
    
    if not vehiculo_data:
        return log_test("GET /api/vehiculos/:id", False, "No vehiculo data from previous test")
    
    vehiculo_id = vehiculo_data.get("vehiculo_id")
    resp = make_request("GET", f"/vehiculos/{vehiculo_id}", token=tokens["admin"])
    
    if not resp:
        return log_test("GET /api/vehiculos/:id", False, "Request failed")
    
    if resp.status_code != 200:
        return log_test("GET /api/vehiculos/:id", False, f"Expected 200, got {resp.status_code}")
    
    data = resp.json()
    
    # Check structure
    if "recurso" not in data:
        return log_test("GET /api/vehiculos/:id", False, "Missing 'recurso' field")
    
    if "asignaciones" not in data:
        return log_test("GET /api/vehiculos/:id", False, "Missing 'asignaciones' field")
    
    if "acreditacion" not in data:
        return log_test("GET /api/vehiculos/:id", False, "Missing 'acreditacion' field")
    
    asignaciones = data.get("asignaciones", [])
    acreditacion = data.get("acreditacion", [])
    
    # Check for at least 1 active assignment
    active_asignaciones = [a for a in asignaciones if a.get("estado") == "activo"]
    if len(active_asignaciones) < 1:
        return log_test("GET /api/vehiculos/:id", False, f"Expected >=1 active assignment, got {len(active_asignaciones)}")
    
    # Check acreditacion structure
    if len(acreditacion) > 0:
        acred = acreditacion[0]
        if "estado" not in acred:
            return log_test("GET /api/vehiculos/:id", False, "Acreditacion missing 'estado' field")
        if "detalle" not in acred:
            return log_test("GET /api/vehiculos/:id", False, "Acreditacion missing 'detalle' field")
        
        # Check detalle has requisitos
        detalle = acred.get("detalle", [])
        if len(detalle) > 0:
            req = detalle[0]
            expected_fields = ["requisito_id", "nombre", "obligatorio", "estado"]
            for field in expected_fields:
                if field not in req:
                    return log_test("GET /api/vehiculos/:id", False, f"Requisito missing '{field}' field")
            
            # Check for expected requisito names (Permiso de Circulación, SOAP, Revisión Técnica)
            requisito_names = [r.get("nombre") for r in detalle]
            print(f"   Found requisitos: {', '.join(requisito_names)}")
    
    return log_test("GET /api/vehiculos/:id", True, f"Found {len(asignaciones)} asignaciones, {len(acreditacion)} acreditacion entries")

# ============================================================================
# TEST 3: GET /api/equipos (admin) -> list (>=3)
# ============================================================================

def test_equipos_list():
    """Test 3: GET /api/equipos returns list with >=3 equipos"""
    print("\n=== Test 3: GET /api/equipos (list) ===")
    global equipo_data
    
    resp = make_request("GET", "/equipos", token=tokens["admin"])
    
    if not resp:
        return log_test("GET /api/equipos", False, "Request failed")
    
    if resp.status_code != 200:
        return log_test("GET /api/equipos", False, f"Expected 200, got {resp.status_code}")
    
    data = resp.json()
    equipos = data.get("equipos", [])
    
    if len(equipos) < 3:
        return log_test("GET /api/equipos", False, f"Expected >=3 equipos, got {len(equipos)}")
    
    # Store first equipo for later tests
    equipo_data = equipos[0]
    
    return log_test("GET /api/equipos", True, f"Found {len(equipos)} equipos")

# ============================================================================
# TEST 4: GET /api/equipos/:id -> {recurso, asignaciones, acreditacion}
# ============================================================================

def test_equipos_detail():
    """Test 4: GET /api/equipos/:id returns recurso with asignaciones and acreditacion"""
    print("\n=== Test 4: GET /api/equipos/:id (detail) ===")
    
    if not equipo_data:
        return log_test("GET /api/equipos/:id", False, "No equipo data from previous test")
    
    equipo_id = equipo_data.get("equipo_id")
    resp = make_request("GET", f"/equipos/{equipo_id}", token=tokens["admin"])
    
    if not resp:
        return log_test("GET /api/equipos/:id", False, "Request failed")
    
    if resp.status_code != 200:
        return log_test("GET /api/equipos/:id", False, f"Expected 200, got {resp.status_code}")
    
    data = resp.json()
    
    # Check structure
    if "recurso" not in data:
        return log_test("GET /api/equipos/:id", False, "Missing 'recurso' field")
    
    if "asignaciones" not in data:
        return log_test("GET /api/equipos/:id", False, "Missing 'asignaciones' field")
    
    if "acreditacion" not in data:
        return log_test("GET /api/equipos/:id", False, "Missing 'acreditacion' field")
    
    asignaciones = data.get("asignaciones", [])
    acreditacion = data.get("acreditacion", [])
    
    # Check acreditacion structure
    if len(acreditacion) > 0:
        acred = acreditacion[0]
        if "detalle" in acred:
            detalle = acred.get("detalle", [])
            if len(detalle) > 0:
                # Check for expected requisito names (Certificado de Mantención, Check List Equipo)
                requisito_names = [r.get("nombre") for r in detalle]
                print(f"   Found requisitos: {', '.join(requisito_names)}")
    
    return log_test("GET /api/equipos/:id", True, f"Found {len(asignaciones)} asignaciones, {len(acreditacion)} acreditacion entries")

# ============================================================================
# TEST 5: POST /api/vehiculos/asignar - Duplicate mandante (409)
# ============================================================================

def test_vehiculos_asignar_duplicate_mandante():
    """Test 5: POST /api/vehiculos/asignar with duplicate mandante returns 409"""
    print("\n=== Test 5: POST /api/vehiculos/asignar (duplicate mandante) ===")
    
    if not vehiculo_data:
        return log_test("POST /api/vehiculos/asignar (duplicate)", False, "No vehiculo data")
    
    # Get vehiculo detail to find its existing assignment
    vehiculo_id = vehiculo_data.get("vehiculo_id")
    resp = make_request("GET", f"/vehiculos/{vehiculo_id}", token=tokens["admin"])
    
    if not resp or resp.status_code != 200:
        return log_test("POST /api/vehiculos/asignar (duplicate)", False, "Failed to get vehiculo detail")
    
    detail = resp.json()
    asignaciones = detail.get("asignaciones", [])
    active_asignaciones = [a for a in asignaciones if a.get("estado") == "activo"]
    
    if len(active_asignaciones) == 0:
        return log_test("POST /api/vehiculos/asignar (duplicate)", False, "No active assignment found")
    
    # Try to assign to the same contrato again (should fail with 409)
    existing_contrato_id = active_asignaciones[0].get("contrato_id")
    
    resp = make_request("POST", "/vehiculos/asignar", token=tokens["admin"], data={
        "recurso_id": vehiculo_id,
        "contrato_id": existing_contrato_id
    })
    
    if resp is None:
        return log_test("POST /api/vehiculos/asignar (duplicate)", False, "Request failed (network error)")
    
    if resp.status_code != 409:
        return log_test("POST /api/vehiculos/asignar (duplicate)", False, f"Expected 409, got {resp.status_code}")
    
    return log_test("POST /api/vehiculos/asignar (duplicate)", True, "Correctly rejected duplicate mandante with 409")

# ============================================================================
# TEST 6: POST /api/vehiculos/asignar - Empresa mismatch (400)
# ============================================================================

def test_vehiculos_asignar_empresa_mismatch():
    """Test 6: POST /api/vehiculos/asignar with empresa mismatch returns 400"""
    print("\n=== Test 6: POST /api/vehiculos/asignar (empresa mismatch) ===")
    
    if not vehiculo_data:
        return log_test("POST /api/vehiculos/asignar (mismatch)", False, "No vehiculo data")
    
    vehiculo_id = vehiculo_data.get("vehiculo_id")
    vehiculo_empresa_id = vehiculo_data.get("empresa_id")
    
    # Get all contratos and find one with different empresa
    resp = make_request("GET", "/contratos", token=tokens["admin"])
    
    if not resp or resp.status_code != 200:
        return log_test("POST /api/vehiculos/asignar (mismatch)", False, "Failed to get contratos")
    
    contratos = resp.json().get("contratos", [])
    different_empresa_contrato = None
    
    for contrato in contratos:
        if contrato.get("empresa_id") != vehiculo_empresa_id:
            different_empresa_contrato = contrato
            break
    
    if not different_empresa_contrato:
        return log_test("POST /api/vehiculos/asignar (mismatch)", False, "No contrato with different empresa found")
    
    # Try to assign vehiculo to contrato of different empresa (should fail with 400)
    resp = make_request("POST", "/vehiculos/asignar", token=tokens["admin"], data={
        "recurso_id": vehiculo_id,
        "contrato_id": different_empresa_contrato.get("contrato_id")
    })
    
    if resp is None:
        return log_test("POST /api/vehiculos/asignar (mismatch)", False, "Request failed (network error)")
    
    if resp.status_code != 400:
        return log_test("POST /api/vehiculos/asignar (mismatch)", False, f"Expected 400, got {resp.status_code}")
    
    return log_test("POST /api/vehiculos/asignar (mismatch)", True, "Correctly rejected empresa mismatch with 400")

# ============================================================================
# TEST 7: POST /api/equipos/asignar - Duplicate mandante (409)
# ============================================================================

def test_equipos_asignar_duplicate_mandante():
    """Test 7: POST /api/equipos/asignar with duplicate mandante returns 409"""
    print("\n=== Test 7: POST /api/equipos/asignar (duplicate mandante) ===")
    
    if not equipo_data:
        return log_test("POST /api/equipos/asignar (duplicate)", False, "No equipo data")
    
    # Get equipo detail to find its existing assignment
    equipo_id = equipo_data.get("equipo_id")
    resp = make_request("GET", f"/equipos/{equipo_id}", token=tokens["admin"])
    
    if not resp or resp.status_code != 200:
        return log_test("POST /api/equipos/asignar (duplicate)", False, "Failed to get equipo detail")
    
    detail = resp.json()
    asignaciones = detail.get("asignaciones", [])
    active_asignaciones = [a for a in asignaciones if a.get("estado") == "activo"]
    
    if len(active_asignaciones) == 0:
        return log_test("POST /api/equipos/asignar (duplicate)", False, "No active assignment found")
    
    # Try to assign to the same contrato again (should fail with 409)
    existing_contrato_id = active_asignaciones[0].get("contrato_id")
    
    resp = make_request("POST", "/equipos/asignar", token=tokens["admin"], data={
        "recurso_id": equipo_id,
        "contrato_id": existing_contrato_id
    })
    
    if resp is None:
        return log_test("POST /api/equipos/asignar (duplicate)", False, "Request failed (network error)")
    
    if resp.status_code != 409:
        return log_test("POST /api/equipos/asignar (duplicate)", False, f"Expected 409, got {resp.status_code}")
    
    return log_test("POST /api/equipos/asignar (duplicate)", True, "Correctly rejected duplicate mandante with 409")

# ============================================================================
# TEST 8: POST /api/equipos/asignar - Empresa mismatch (400)
# ============================================================================

def test_equipos_asignar_empresa_mismatch():
    """Test 8: POST /api/equipos/asignar with empresa mismatch returns 400"""
    print("\n=== Test 8: POST /api/equipos/asignar (empresa mismatch) ===")
    
    if not equipo_data:
        return log_test("POST /api/equipos/asignar (mismatch)", False, "No equipo data")
    
    equipo_id = equipo_data.get("equipo_id")
    equipo_empresa_id = equipo_data.get("empresa_id")
    
    # Get all contratos and find one with different empresa
    resp = make_request("GET", "/contratos", token=tokens["admin"])
    
    if not resp or resp.status_code != 200:
        return log_test("POST /api/equipos/asignar (mismatch)", False, "Failed to get contratos")
    
    contratos = resp.json().get("contratos", [])
    different_empresa_contrato = None
    
    for contrato in contratos:
        if contrato.get("empresa_id") != equipo_empresa_id:
            different_empresa_contrato = contrato
            break
    
    if not different_empresa_contrato:
        return log_test("POST /api/equipos/asignar (mismatch)", False, "No contrato with different empresa found")
    
    # Try to assign equipo to contrato of different empresa (should fail with 400)
    resp = make_request("POST", "/equipos/asignar", token=tokens["admin"], data={
        "recurso_id": equipo_id,
        "contrato_id": different_empresa_contrato.get("contrato_id")
    })
    
    if resp is None:
        return log_test("POST /api/equipos/asignar (mismatch)", False, "Request failed (network error)")
    
    if resp.status_code != 400:
        return log_test("POST /api/equipos/asignar (mismatch)", False, f"Expected 400, got {resp.status_code}")
    
    return log_test("POST /api/equipos/asignar (mismatch)", True, "Correctly rejected empresa mismatch with 400")

# ============================================================================
# TEST 9: Document upload for vehiculo
# ============================================================================

def test_vehiculo_document_upload():
    """Test 9: POST /api/documentos/upload for vehiculo with requisito"""
    print("\n=== Test 9: POST /api/documentos/upload (vehiculo) ===")
    
    if not vehiculo_data:
        return log_test("Document upload (vehiculo)", False, "No vehiculo data")
    
    # Get vehiculo detail with acreditacion
    vehiculo_id = vehiculo_data.get("vehiculo_id")
    resp = make_request("GET", f"/vehiculos/{vehiculo_id}", token=tokens["admin"])
    
    if not resp or resp.status_code != 200:
        return log_test("Document upload (vehiculo)", False, "Failed to get vehiculo detail")
    
    detail = resp.json()
    acreditacion = detail.get("acreditacion", [])
    
    if len(acreditacion) == 0:
        return log_test("Document upload (vehiculo)", False, "No acreditacion found for vehiculo")
    
    acred = acreditacion[0]
    mandante_id = acred.get("mandante_id")
    detalle = acred.get("detalle", [])
    
    if len(detalle) == 0:
        return log_test("Document upload (vehiculo)", False, "No requisitos found in acreditacion")
    
    # Find a requisito with estado 'faltante'
    requisito = None
    for req in detalle:
        if req.get("estado") == "faltante":
            requisito = req
            break
    
    if not requisito:
        # If no faltante, use first requisito
        requisito = detalle[0]
    
    requisito_id = requisito.get("requisito_id")
    
    # Create a dummy PDF file
    file_content = b"%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/Resources <<\n/Font <<\n/F1 4 0 R\n>>\n>>\n/MediaBox [0 0 612 792]\n/Contents 5 0 R\n>>\nendobj\n4 0 obj\n<<\n/Type /Font\n/Subtype /Type1\n/BaseFont /Helvetica\n>>\nendobj\n5 0 obj\n<<\n/Length 44\n>>\nstream\nBT\n/F1 12 Tf\n100 700 Td\n(Test Document) Tj\nET\nendstream\nendobj\nxref\n0 6\n0000000000 65535 f\n0000000009 00000 n\n0000000058 00000 n\n0000000115 00000 n\n0000000262 00000 n\n0000000341 00000 n\ntrailer\n<<\n/Size 6\n/Root 1 0 R\n>>\nstartxref\n433\n%%EOF"
    
    files = {
        'file': ('permiso_circulacion.pdf', io.BytesIO(file_content), 'application/pdf')
    }
    
    form_data = {
        'recurso_tipo': 'vehiculo',
        'recurso_id': vehiculo_id,
        'requisito_id': requisito_id,
        'mandante_id': mandante_id,
        'fecha_vencimiento': '2027-06-01'
    }
    
    resp = make_request("POST", "/documentos/upload", token=tokens["admin"], data=form_data, files=files)
    
    if not resp:
        return log_test("Document upload (vehiculo)", False, "Request failed")
    
    if resp.status_code != 201:
        return log_test("Document upload (vehiculo)", False, f"Expected 201, got {resp.status_code}: {resp.text}")
    
    doc_data = resp.json()
    documento = doc_data.get("documento")
    
    if not documento:
        return log_test("Document upload (vehiculo)", False, "No documento in response")
    
    if documento.get("estado") != "en_revision":
        return log_test("Document upload (vehiculo)", False, f"Expected estado 'en_revision', got '{documento.get('estado')}'")
    
    # Verify the requisito estado changed
    resp2 = make_request("GET", f"/vehiculos/{vehiculo_id}", token=tokens["admin"])
    if resp2 and resp2.status_code == 200:
        detail2 = resp2.json()
        acreditacion2 = detail2.get("acreditacion", [])
        if len(acreditacion2) > 0:
            detalle2 = acreditacion2[0].get("detalle", [])
            for req in detalle2:
                if req.get("requisito_id") == requisito_id:
                    new_estado = req.get("estado")
                    print(f"   Requisito estado changed to: {new_estado}")
                    if new_estado == "en_revision":
                        return log_test("Document upload (vehiculo)", True, "Document uploaded and requisito estado updated to 'en_revision'")
    
    return log_test("Document upload (vehiculo)", True, "Document uploaded successfully")

# ============================================================================
# TEST 10: Authorization - mandante cannot asignar vehiculos
# ============================================================================

def test_vehiculos_asignar_as_mandante():
    """Test 10: POST /api/vehiculos/asignar as mandante returns 403"""
    print("\n=== Test 10: POST /api/vehiculos/asignar (as mandante) ===")
    
    if not vehiculo_data:
        return log_test("POST /api/vehiculos/asignar (mandante)", False, "No vehiculo data")
    
    # Get a contrato
    resp = make_request("GET", "/contratos", token=tokens["admin"])
    if not resp or resp.status_code != 200:
        return log_test("POST /api/vehiculos/asignar (mandante)", False, "Failed to get contratos")
    
    contratos = resp.json().get("contratos", [])
    if len(contratos) == 0:
        return log_test("POST /api/vehiculos/asignar (mandante)", False, "No contratos found")
    
    # Try to assign as mandante (should fail with 403)
    resp = make_request("POST", "/vehiculos/asignar", token=tokens["mandante"], data={
        "recurso_id": vehiculo_data.get("vehiculo_id"),
        "contrato_id": contratos[0].get("contrato_id")
    })
    
    if resp is None:
        return log_test("POST /api/vehiculos/asignar (mandante)", False, "Request failed (network error)")
    
    if resp.status_code != 403:
        return log_test("POST /api/vehiculos/asignar (mandante)", False, f"Expected 403, got {resp.status_code}")
    
    return log_test("POST /api/vehiculos/asignar (mandante)", True, "Correctly rejected mandante with 403")

# ============================================================================
# TEST 11: Authorization - mandante cannot asignar equipos
# ============================================================================

def test_equipos_asignar_as_mandante():
    """Test 11: POST /api/equipos/asignar as mandante returns 403"""
    print("\n=== Test 11: POST /api/equipos/asignar (as mandante) ===")
    
    if not equipo_data:
        return log_test("POST /api/equipos/asignar (mandante)", False, "No equipo data")
    
    # Get a contrato
    resp = make_request("GET", "/contratos", token=tokens["admin"])
    if not resp or resp.status_code != 200:
        return log_test("POST /api/equipos/asignar (mandante)", False, "Failed to get contratos")
    
    contratos = resp.json().get("contratos", [])
    if len(contratos) == 0:
        return log_test("POST /api/equipos/asignar (mandante)", False, "No contratos found")
    
    # Try to assign as mandante (should fail with 403)
    resp = make_request("POST", "/equipos/asignar", token=tokens["mandante"], data={
        "recurso_id": equipo_data.get("equipo_id"),
        "contrato_id": contratos[0].get("contrato_id")
    })
    
    if resp is None:
        return log_test("POST /api/equipos/asignar (mandante)", False, "Request failed (network error)")
    
    if resp.status_code != 403:
        return log_test("POST /api/equipos/asignar (mandante)", False, f"Expected 403, got {resp.status_code}")
    
    return log_test("POST /api/equipos/asignar (mandante)", True, "Correctly rejected mandante with 403")

# ============================================================================
# TEST 12: Regression - Dashboard
# ============================================================================

def test_dashboard_regression():
    """Test 12: GET /api/dashboard still returns 200"""
    print("\n=== Test 12: GET /api/dashboard (regression) ===")
    
    resp = make_request("GET", "/dashboard", token=tokens["admin"])
    
    if not resp:
        return log_test("GET /api/dashboard", False, "Request failed")
    
    if resp.status_code != 200:
        return log_test("GET /api/dashboard", False, f"Expected 200, got {resp.status_code}")
    
    data = resp.json()
    
    if "stats" not in data:
        return log_test("GET /api/dashboard", False, "Missing 'stats' field")
    
    return log_test("GET /api/dashboard", True, "Dashboard endpoint working")

# ============================================================================
# TEST 13: Regression - Login
# ============================================================================

def test_login_regression():
    """Test 13: POST /api/auth/login still works"""
    print("\n=== Test 13: POST /api/auth/login (regression) ===")
    
    resp = make_request("POST", "/auth/login", data={
        "email": "admin@aptivarl.com",
        "password": "Aptiva2025!"
    })
    
    if not resp:
        return log_test("POST /api/auth/login", False, "Request failed")
    
    if resp.status_code != 200:
        return log_test("POST /api/auth/login", False, f"Expected 200, got {resp.status_code}")
    
    data = resp.json()
    
    if "token" not in data:
        return log_test("POST /api/auth/login", False, "Missing 'token' field")
    
    if "profile" not in data:
        return log_test("POST /api/auth/login", False, "Missing 'profile' field")
    
    return log_test("POST /api/auth/login", True, "Login endpoint working")

# ============================================================================
# MAIN
# ============================================================================

def main():
    print("=" * 80)
    print("PHASE 3 BACKEND TESTS - Aptiva RL")
    print("Testing: Vehiculos & Equipos with Assignments + Documental Accreditation")
    print("=" * 80)
    
    # Setup
    if not setup_auth():
        print("\n❌ SETUP FAILED: Could not authenticate users")
        return 1
    
    results = []
    
    # Phase 3 Tests
    results.append(test_vehiculos_list())
    results.append(test_vehiculos_detail())
    results.append(test_equipos_list())
    results.append(test_equipos_detail())
    results.append(test_vehiculos_asignar_duplicate_mandante())
    results.append(test_vehiculos_asignar_empresa_mismatch())
    results.append(test_equipos_asignar_duplicate_mandante())
    results.append(test_equipos_asignar_empresa_mismatch())
    results.append(test_vehiculo_document_upload())
    results.append(test_vehiculos_asignar_as_mandante())
    results.append(test_equipos_asignar_as_mandante())
    
    # Regression Tests
    results.append(test_dashboard_regression())
    results.append(test_login_regression())
    
    # Summary
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    passed = sum(1 for r in results if r)
    total = len(results)
    print(f"Passed: {passed}/{total}")
    print(f"Failed: {total - passed}/{total}")
    
    if passed == total:
        print("\n🎉 ALL PHASE 3 TESTS PASSED!")
        return 0
    else:
        print(f"\n⚠️  {total - passed} TEST(S) FAILED")
        return 1

if __name__ == "__main__":
    sys.exit(main())
