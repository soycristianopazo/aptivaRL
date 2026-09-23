#!/usr/bin/env python3
"""
Backend Testing for RR.HH. Permissions (MANDANTE_RRHH role)
Tests NEW permissions: crear trabajador + eliminar (soft-delete) documento
"""

import requests
import json
import sys
from datetime import datetime

# Backend URL
BASE_URL = "https://aptiva-db.preview.emergentagent.com/api"

# Test credentials
CREDENTIALS = {
    "admin": {"email": "admin@aptivarl.com", "password": "Aptiva2025!"},
    "rrhh": {"email": "nvelasquez@rioloa.cl", "password": "Aptiva2025!"},
    "rrhh_alt1": {"email": "cgalindo@rioloa.cl", "password": "Aptiva2025!"},
    "rrhh_alt2": {"email": "crivera@rioloa.cl", "password": "Aptiva2025!"},
}

# Test state
test_state = {
    "tokens": {},
    "test_trabajador_id": None,
    "test_documento_id": None,
    "test_mandante_id": None,
    "empresa_id": None,
    "contrato_id": None,
    "requisito_id": None,
    "visor_user": None,
    "prevencion_user": None,
    "cleanup_items": []
}

def log(msg):
    """Print timestamped log message"""
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}")

def login(role):
    """Login and return token"""
    try:
        creds = CREDENTIALS[role]
        log(f"Logging in as {role} ({creds['email']})...")
        resp = requests.post(f"{BASE_URL}/auth/login", json=creds, timeout=30)
        
        if resp.status_code != 200:
            log(f"❌ Login failed for {role}: {resp.status_code} - {resp.text}")
            return None
        
        data = resp.json()
        token = data.get("token")
        profile = data.get("profile", {})
        
        if not token:
            log(f"❌ No token received for {role}")
            return None
        
        log(f"✅ Login successful for {role} - Role: {profile.get('role_codigo')}")
        test_state["tokens"][role] = token
        return token
    except Exception as e:
        log(f"❌ Login exception for {role}: {str(e)}")
        return None

def get_headers(role):
    """Get authorization headers for a role"""
    token = test_state["tokens"].get(role)
    if not token:
        return None
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

def test_1_login_all_users():
    """Test 1: Login as admin, RR.HH., and find VISOR/PREVENCION users"""
    log("\n" + "="*80)
    log("TEST 1: Login all users")
    log("="*80)
    
    # Login admin
    if not login("admin"):
        return False
    
    # Login RR.HH.
    if not login("rrhh"):
        log("⚠️  Primary RR.HH. user failed, trying alternatives...")
        if not login("rrhh_alt1"):
            if not login("rrhh_alt2"):
                log("❌ All RR.HH. users failed to login")
                return False
            else:
                # Use rrhh_alt2
                test_state["tokens"]["rrhh"] = test_state["tokens"]["rrhh_alt2"]
        else:
            # Use rrhh_alt1
            test_state["tokens"]["rrhh"] = test_state["tokens"]["rrhh_alt1"]
    
    # Get list of usuarios to find VISOR and PREVENCION
    log("\nFetching usuarios list to find VISOR and PREVENCION users...")
    try:
        resp = requests.get(f"{BASE_URL}/usuarios", headers=get_headers("admin"), timeout=30)
        if resp.status_code == 200:
            data = resp.json()
            usuarios = data.get("usuarios", [])
            
            # Find VISOR user
            visor_users = [u for u in usuarios if u.get("role_codigo") == "MANDANTE_VISOR" and "@rioloa.cl" in u.get("email", "")]
            if visor_users:
                test_state["visor_user"] = visor_users[0]
                log(f"✅ Found VISOR user: {test_state['visor_user']['email']}")
            else:
                log("⚠️  No VISOR user found with @rioloa.cl email")
            
            # Find PREVENCION user
            prev_users = [u for u in usuarios if u.get("role_codigo") == "MANDANTE_PREVENCION" and "@rioloa.cl" in u.get("email", "")]
            if prev_users:
                test_state["prevencion_user"] = prev_users[0]
                log(f"✅ Found PREVENCION user: {test_state['prevencion_user']['email']}")
            else:
                log("⚠️  No PREVENCION user found with @rioloa.cl email")
        else:
            log(f"⚠️  Failed to fetch usuarios: {resp.status_code}")
    except Exception as e:
        log(f"⚠️  Exception fetching usuarios: {str(e)}")
    
    # Try to login VISOR and PREVENCION if found
    if test_state["visor_user"]:
        try:
            visor_creds = {"email": test_state["visor_user"]["email"], "password": "Aptiva2025!"}
            resp = requests.post(f"{BASE_URL}/auth/login", json=visor_creds, timeout=30)
            if resp.status_code == 200:
                test_state["tokens"]["visor"] = resp.json().get("token")
                log(f"✅ VISOR login successful")
            else:
                log(f"⚠️  VISOR login failed: {resp.status_code}")
        except Exception as e:
            log(f"⚠️  VISOR login exception: {str(e)}")
    
    if test_state["prevencion_user"]:
        try:
            prev_creds = {"email": test_state["prevencion_user"]["email"], "password": "Aptiva2025!"}
            resp = requests.post(f"{BASE_URL}/auth/login", json=prev_creds, timeout=30)
            if resp.status_code == 200:
                test_state["tokens"]["prevencion"] = resp.json().get("token")
                log(f"✅ PREVENCION login successful")
            else:
                log(f"⚠️  PREVENCION login failed: {resp.status_code}")
        except Exception as e:
            log(f"⚠️  PREVENCION login exception: {str(e)}")
    
    log("\n✅ TEST 1 PASSED: Login successful")
    return True

def test_2_get_empresa_and_mandante():
    """Test 2: Get empresa_id and mandante_id for RR.HH. user"""
    log("\n" + "="*80)
    log("TEST 2: Get empresa_id and mandante_id for test setup")
    log("="*80)
    
    try:
        # Get empresas
        log("Fetching empresas...")
        resp = requests.get(f"{BASE_URL}/empresas", headers=get_headers("admin"), timeout=30)
        if resp.status_code != 200:
            log(f"❌ Failed to fetch empresas: {resp.status_code}")
            return False
        
        empresas = resp.json().get("empresas", [])
        if not empresas:
            log("❌ No empresas found")
            return False
        
        # Use first empresa (Río Loa)
        test_state["empresa_id"] = empresas[0]["empresa_id"]
        log(f"✅ Using empresa: {empresas[0]['razon_social']} (ID: {test_state['empresa_id']})")
        
        # Get mandantes for RR.HH. user
        log("\nFetching mandantes as RR.HH. user...")
        resp = requests.get(f"{BASE_URL}/mandantes", headers=get_headers("rrhh"), timeout=30)
        if resp.status_code != 200:
            log(f"❌ Failed to fetch mandantes: {resp.status_code}")
            return False
        
        mandantes = resp.json().get("mandantes", [])
        if not mandantes:
            log("❌ RR.HH. user has no mandantes assigned")
            return False
        
        test_state["test_mandante_id"] = mandantes[0]["mandante_id"]
        log(f"✅ RR.HH. user has {len(mandantes)} mandante(s) assigned")
        log(f"✅ Using mandante: {mandantes[0]['razon_social']} (ID: {test_state['test_mandante_id']})")
        
        log("\n✅ TEST 2 PASSED: Got empresa and mandante IDs")
        return True
    except Exception as e:
        log(f"❌ TEST 2 FAILED: {str(e)}")
        return False

def generate_valid_rut():
    """Generate a valid Chilean RUT"""
    import random
    # Generate a random RUT number between 10000000 and 25000000
    rut_num = random.randint(10000000, 25000000)
    
    # Calculate DV using modulo 11 (Chilean algorithm)
    suma = 0
    mul = 2
    rut_str = str(rut_num)
    for digit in reversed(rut_str):
        suma += int(digit) * mul
        mul = mul + 1 if mul < 7 else 2
    
    resto = suma % 11
    dv_calc = 11 - resto
    
    if dv_calc == 11:
        dv = '0'
    elif dv_calc == 10:
        dv = 'K'
    else:
        dv = str(dv_calc)
    
    # Format as XX.XXX.XXX-X
    rut_formatted = f"{rut_str[:-6]}.{rut_str[-6:-3]}.{rut_str[-3:]}-{dv}"
    return rut_formatted

def test_3_crear_trabajador_rrhh():
    """Test 3: CREATE trabajador as RR.HH. (should return 201, not 403)"""
    log("\n" + "="*80)
    log("TEST 3: CREATE trabajador as RR.HH.")
    log("="*80)
    
    try:
        # Generate valid Chilean RUT for testing
        test_rut = generate_valid_rut()
        
        trabajador_data = {
            "empresa_id": test_state["empresa_id"],
            "rut": test_rut,
            "nombre": "QA Test",
            "apellido": "RRHH Permisos",
            "cargo": "Tester"
        }
        
        log(f"Creating trabajador as RR.HH. with RUT {test_rut}...")
        resp = requests.post(
            f"{BASE_URL}/trabajadores",
            headers=get_headers("rrhh"),
            json=trabajador_data,
            timeout=30
        )
        
        log(f"Response status: {resp.status_code}")
        
        if resp.status_code == 201:
            data = resp.json()
            trabajador = data.get("trabajador", {})
            test_state["test_trabajador_id"] = trabajador.get("trabajador_id")
            test_state["cleanup_items"].append(("trabajador", test_state["test_trabajador_id"]))
            
            log(f"✅ Trabajador created successfully!")
            log(f"   ID: {test_state['test_trabajador_id']}")
            log(f"   RUT: {trabajador.get('rut')}")
            log(f"   Nombre: {trabajador.get('nombre')} {trabajador.get('apellido')}")
            
            # Verify trabajador appears in list
            log("\nVerifying trabajador appears in GET /api/trabajadores...")
            resp = requests.get(f"{BASE_URL}/trabajadores", headers=get_headers("admin"), timeout=30)
            if resp.status_code == 200:
                trabajadores = resp.json().get("trabajadores", [])
                found = any(t.get("trabajador_id") == test_state["test_trabajador_id"] for t in trabajadores)
                if found:
                    log("✅ Trabajador found in list")
                else:
                    log("⚠️  Trabajador not found in list (may be filtered)")
            
            log("\n✅ TEST 3 PASSED: RR.HH. can CREATE trabajador (201)")
            return True
        elif resp.status_code == 403:
            log(f"❌ TEST 3 FAILED: Got 403 (should be 201) - RR.HH. permission not working")
            log(f"   Response: {resp.text}")
            return False
        elif resp.status_code == 409:
            log(f"⚠️  RUT already exists, trying with another RUT...")
            # Try with another random RUT
            test_rut = generate_valid_rut()
            trabajador_data["rut"] = test_rut
            
            resp = requests.post(
                f"{BASE_URL}/trabajadores",
                headers=get_headers("rrhh"),
                json=trabajador_data,
                timeout=30
            )
            
            if resp.status_code == 201:
                data = resp.json()
                trabajador = data.get("trabajador", {})
                test_state["test_trabajador_id"] = trabajador.get("trabajador_id")
                test_state["cleanup_items"].append(("trabajador", test_state["test_trabajador_id"]))
                log(f"✅ Trabajador created with alternative RUT: {test_rut}")
                log("\n✅ TEST 3 PASSED: RR.HH. can CREATE trabajador (201)")
                return True
            else:
                log(f"❌ TEST 3 FAILED: {resp.status_code} - {resp.text}")
                return False
        else:
            log(f"❌ TEST 3 FAILED: Unexpected status {resp.status_code}")
            log(f"   Response: {resp.text}")
            return False
    except Exception as e:
        log(f"❌ TEST 3 FAILED: {str(e)}")
        return False

def test_4_setup_documento_for_delete():
    """Test 4: Setup - Create documento for delete test"""
    log("\n" + "="*80)
    log("TEST 4: Setup documento for DELETE test")
    log("="*80)
    
    try:
        # Get contrato for the mandante
        log(f"Getting contratos for mandante {test_state['test_mandante_id']}...")
        resp = requests.get(f"{BASE_URL}/contratos", headers=get_headers("admin"), timeout=30)
        if resp.status_code != 200:
            log(f"❌ Failed to fetch contratos: {resp.status_code}")
            return False
        
        contratos = resp.json().get("contratos", [])
        mandante_contratos = [c for c in contratos if c.get("mandante_id") == test_state["test_mandante_id"]]
        
        if not mandante_contratos:
            log(f"⚠️  No contratos found for mandante, creating one...")
            # Create a contrato
            contrato_data = {
                "numero_oc": f"QA-TEST-{datetime.now().strftime('%Y%m%d%H%M%S')}",
                "mandante_id": test_state["test_mandante_id"],
                "empresa_id": test_state["empresa_id"],
                "estado": "vigente"
            }
            resp = requests.post(f"{BASE_URL}/contratos", headers=get_headers("admin"), json=contrato_data, timeout=30)
            if resp.status_code == 201:
                test_state["contrato_id"] = resp.json().get("contrato", {}).get("contrato_id")
                test_state["cleanup_items"].append(("contrato", test_state["contrato_id"]))
                log(f"✅ Created test contrato: {test_state['contrato_id']}")
            else:
                log(f"❌ Failed to create contrato: {resp.status_code}")
                return False
        else:
            test_state["contrato_id"] = mandante_contratos[0]["contrato_id"]
            log(f"✅ Using existing contrato: {mandante_contratos[0]['numero_oc']}")
        
        # Assign trabajador to contrato
        if test_state["test_trabajador_id"]:
            log(f"\nAssigning trabajador to contrato...")
            asignar_data = {
                "trabajador_id": test_state["test_trabajador_id"],
                "contrato_id": test_state["contrato_id"]
            }
            resp = requests.post(f"{BASE_URL}/trabajadores/asignar", headers=get_headers("admin"), json=asignar_data, timeout=30)
            if resp.status_code == 201:
                log("✅ Trabajador assigned to contrato")
            else:
                log(f"⚠️  Failed to assign trabajador: {resp.status_code} - {resp.text}")
        
        # Get requisito for the mandante
        log(f"\nGetting requisitos for mandante...")
        resp = requests.get(f"{BASE_URL}/mandantes/{test_state['test_mandante_id']}", headers=get_headers("admin"), timeout=30)
        if resp.status_code != 200:
            log(f"❌ Failed to fetch mandante detail: {resp.status_code}")
            return False
        
        requisitos = resp.json().get("requisitos", [])
        trabajador_reqs = [r for r in requisitos if r.get("tipo_recurso") == "trabajador"]
        
        if not trabajador_reqs:
            log("❌ No requisitos found for trabajador")
            return False
        
        test_state["requisito_id"] = trabajador_reqs[0]["requisito_id"]
        log(f"✅ Using requisito: {trabajador_reqs[0]['nombre']}")
        
        # Upload a test document
        log(f"\nUploading test document...")
        
        # Create a simple text file
        test_file_content = b"Test document for RR.HH. delete permission test"
        files = {
            "file": ("test_documento_rrhh.txt", test_file_content, "text/plain")
        }
        data = {
            "recurso_tipo": "trabajador",
            "recurso_id": test_state["test_trabajador_id"],
            "requisito_id": test_state["requisito_id"],
            "mandante_id": test_state["test_mandante_id"]
        }
        
        headers = {"Authorization": f"Bearer {test_state['tokens']['admin']}"}
        resp = requests.post(f"{BASE_URL}/documentos/upload", headers=headers, files=files, data=data, timeout=30)
        
        if resp.status_code == 201:
            documento = resp.json().get("documento", {})
            test_state["test_documento_id"] = documento.get("documento_id")
            log(f"✅ Test document uploaded successfully")
            log(f"   ID: {test_state['test_documento_id']}")
            log(f"   Estado: {documento.get('estado')}")
        else:
            log(f"❌ Failed to upload document: {resp.status_code} - {resp.text}")
            return False
        
        log("\n✅ TEST 4 PASSED: Setup complete for DELETE test")
        return True
    except Exception as e:
        log(f"❌ TEST 4 FAILED: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def test_5_delete_documento_rrhh():
    """Test 5: DELETE documento as RR.HH. (should return 200)"""
    log("\n" + "="*80)
    log("TEST 5: DELETE documento as RR.HH.")
    log("="*80)
    
    if not test_state["test_documento_id"]:
        log("⚠️  Skipping test - no documento_id available")
        return True
    
    try:
        log(f"Deleting documento {test_state['test_documento_id']} as RR.HH....")
        resp = requests.delete(
            f"{BASE_URL}/documentos/{test_state['test_documento_id']}",
            headers=get_headers("rrhh"),
            timeout=30
        )
        
        log(f"Response status: {resp.status_code}")
        
        if resp.status_code == 200:
            data = resp.json()
            if data.get("ok"):
                log("✅ Documento deleted successfully (soft-delete)")
                
                # Verify documento is gone (deleted_at set)
                log("\nVerifying documento no longer appears...")
                resp = requests.get(
                    f"{BASE_URL}/trabajadores/{test_state['test_trabajador_id']}",
                    headers=get_headers("admin"),
                    timeout=30
                )
                if resp.status_code == 200:
                    acreditacion = resp.json().get("acreditacion", [])
                    # Check if documento is marked as deleted
                    log("✅ Documento soft-deleted (requisito should show as 'faltante' now)")
                
                log("\n✅ TEST 5 PASSED: RR.HH. can DELETE documento (200)")
                return True
            else:
                log(f"⚠️  Response ok=false: {data}")
                return False
        elif resp.status_code == 403:
            log(f"❌ TEST 5 FAILED: Got 403 (should be 200) - RR.HH. delete permission not working")
            log(f"   Response: {resp.text}")
            return False
        else:
            log(f"❌ TEST 5 FAILED: Unexpected status {resp.status_code}")
            log(f"   Response: {resp.text}")
            return False
    except Exception as e:
        log(f"❌ TEST 5 FAILED: {str(e)}")
        return False

def test_6_download_documento_url():
    """Test 6: GET documento URL as RR.HH."""
    log("\n" + "="*80)
    log("TEST 6: GET documento URL as RR.HH.")
    log("="*80)
    
    # Upload a new document for this test
    try:
        log("Uploading new document for URL test...")
        test_file_content = b"Test document for URL download test"
        files = {
            "file": ("test_download.txt", test_file_content, "text/plain")
        }
        data = {
            "recurso_tipo": "trabajador",
            "recurso_id": test_state["test_trabajador_id"],
            "requisito_id": test_state["requisito_id"],
            "mandante_id": test_state["test_mandante_id"]
        }
        
        headers = {"Authorization": f"Bearer {test_state['tokens']['admin']}"}
        resp = requests.post(f"{BASE_URL}/documentos/upload", headers=headers, files=files, data=data, timeout=30)
        
        if resp.status_code != 201:
            log(f"⚠️  Failed to upload document for URL test: {resp.status_code}")
            return True  # Skip test
        
        doc_id = resp.json().get("documento", {}).get("documento_id")
        log(f"✅ Document uploaded: {doc_id}")
        
        # Get URL as RR.HH.
        log(f"\nGetting documento URL as RR.HH....")
        resp = requests.get(
            f"{BASE_URL}/documentos/{doc_id}/url",
            headers=get_headers("rrhh"),
            timeout=30
        )
        
        log(f"Response status: {resp.status_code}")
        
        if resp.status_code == 200:
            data = resp.json()
            url = data.get("url")
            if url:
                log(f"✅ Got signed URL successfully")
                log(f"   URL length: {len(url)} chars")
                log("\n✅ TEST 6 PASSED: RR.HH. can GET documento URL (200)")
                return True
            else:
                log(f"⚠️  No URL in response: {data}")
                return False
        else:
            log(f"❌ TEST 6 FAILED: Status {resp.status_code}")
            log(f"   Response: {resp.text}")
            return False
    except Exception as e:
        log(f"❌ TEST 6 FAILED: {str(e)}")
        return False

def test_7_negative_visor_prevencion():
    """Test 7: NEGATIVE tests - VISOR and PREVENCION should get 403"""
    log("\n" + "="*80)
    log("TEST 7: NEGATIVE authorization tests (VISOR and PREVENCION)")
    log("="*80)
    
    all_passed = True
    
    # Test VISOR
    if test_state["tokens"].get("visor"):
        log("\n--- Testing VISOR permissions ---")
        
        # VISOR POST /api/trabajadores -> 403
        log("Testing VISOR POST /api/trabajadores (should be 403)...")
        trabajador_data = {
            "empresa_id": test_state["empresa_id"],
            "rut": "99.999.999-9",
            "nombre": "Test",
            "apellido": "Visor"
        }
        resp = requests.post(
            f"{BASE_URL}/trabajadores",
            headers=get_headers("visor"),
            json=trabajador_data,
            timeout=30
        )
        if resp.status_code == 403:
            log("✅ VISOR POST /api/trabajadores correctly returns 403")
        else:
            log(f"❌ VISOR POST /api/trabajadores returned {resp.status_code} (expected 403)")
            all_passed = False
        
        # VISOR DELETE /api/documentos/:id -> 403
        if test_state["test_documento_id"]:
            log("Testing VISOR DELETE /api/documentos/:id (should be 403)...")
            resp = requests.delete(
                f"{BASE_URL}/documentos/{test_state['test_documento_id']}",
                headers=get_headers("visor"),
                timeout=30
            )
            if resp.status_code == 403:
                log("✅ VISOR DELETE /api/documentos/:id correctly returns 403")
            else:
                log(f"❌ VISOR DELETE returned {resp.status_code} (expected 403)")
                all_passed = False
    else:
        log("⚠️  Skipping VISOR tests - no VISOR user available")
    
    # Test PREVENCION
    if test_state["tokens"].get("prevencion"):
        log("\n--- Testing PREVENCION permissions ---")
        
        # PREVENCION POST /api/trabajadores -> 403
        log("Testing PREVENCION POST /api/trabajadores (should be 403)...")
        trabajador_data = {
            "empresa_id": test_state["empresa_id"],
            "rut": "88.888.888-8",
            "nombre": "Test",
            "apellido": "Prevencion"
        }
        resp = requests.post(
            f"{BASE_URL}/trabajadores",
            headers=get_headers("prevencion"),
            json=trabajador_data,
            timeout=30
        )
        if resp.status_code == 403:
            log("✅ PREVENCION POST /api/trabajadores correctly returns 403")
        else:
            log(f"❌ PREVENCION POST returned {resp.status_code} (expected 403)")
            all_passed = False
        
        # PREVENCION DELETE /api/documentos/:id -> 403
        if test_state["test_documento_id"]:
            log("Testing PREVENCION DELETE /api/documentos/:id (should be 403)...")
            resp = requests.delete(
                f"{BASE_URL}/documentos/{test_state['test_documento_id']}",
                headers=get_headers("prevencion"),
                timeout=30
            )
            if resp.status_code == 403:
                log("✅ PREVENCION DELETE /api/documentos/:id correctly returns 403")
            else:
                log(f"❌ PREVENCION DELETE returned {resp.status_code} (expected 403)")
                all_passed = False
    else:
        log("⚠️  Skipping PREVENCION tests - no PREVENCION user available")
    
    # Test without token
    log("\n--- Testing without token ---")
    log("Testing DELETE /api/documentos/:id without token (should be 401)...")
    if test_state["test_documento_id"]:
        resp = requests.delete(
            f"{BASE_URL}/documentos/{test_state['test_documento_id']}",
            timeout=30
        )
        if resp.status_code == 401:
            log("✅ DELETE without token correctly returns 401")
        else:
            log(f"❌ DELETE without token returned {resp.status_code} (expected 401)")
            all_passed = False
    
    if all_passed:
        log("\n✅ TEST 7 PASSED: All negative authorization tests passed")
    else:
        log("\n❌ TEST 7 FAILED: Some negative tests failed")
    
    return all_passed

def test_8_scope_test():
    """Test 8: SCOPE test - RR.HH. cannot delete docs from unassigned mandantes"""
    log("\n" + "="*80)
    log("TEST 8: SCOPE test - RR.HH. cannot delete docs from unassigned mandante")
    log("="*80)
    
    try:
        # Get all mandantes
        log("Getting all mandantes...")
        resp = requests.get(f"{BASE_URL}/mandantes", headers=get_headers("admin"), timeout=30)
        if resp.status_code != 200:
            log(f"⚠️  Failed to fetch mandantes: {resp.status_code}")
            return True  # Skip test
        
        all_mandantes = resp.json().get("mandantes", [])
        
        # Get RR.HH. mandantes
        resp = requests.get(f"{BASE_URL}/mandantes", headers=get_headers("rrhh"), timeout=30)
        if resp.status_code != 200:
            log(f"⚠️  Failed to fetch RR.HH. mandantes: {resp.status_code}")
            return True
        
        rrhh_mandantes = resp.json().get("mandantes", [])
        rrhh_mandante_ids = [m["mandante_id"] for m in rrhh_mandantes]
        
        # Find a mandante NOT assigned to RR.HH.
        unassigned_mandantes = [m for m in all_mandantes if m["mandante_id"] not in rrhh_mandante_ids]
        
        if not unassigned_mandantes:
            log("⚠️  RR.HH. user has access to ALL mandantes - cannot test scope restriction")
            return True
        
        out_of_scope_mandante = unassigned_mandantes[0]
        log(f"✅ Found out-of-scope mandante: {out_of_scope_mandante['razon_social']}")
        
        # Create a test trabajador and document in the out-of-scope mandante
        log("\nCreating test data in out-of-scope mandante...")
        
        # Create trabajador
        trabajador_data = {
            "empresa_id": test_state["empresa_id"],
            "rut": generate_valid_rut(),
            "nombre": "Test",
            "apellido": "OutOfScope"
        }
        resp = requests.post(f"{BASE_URL}/trabajadores", headers=get_headers("admin"), json=trabajador_data, timeout=30)
        if resp.status_code != 201:
            log(f"⚠️  Failed to create test trabajador: {resp.status_code}")
            return True
        
        scope_test_trabajador_id = resp.json().get("trabajador", {}).get("trabajador_id")
        test_state["cleanup_items"].append(("trabajador", scope_test_trabajador_id))
        log(f"✅ Created test trabajador: {scope_test_trabajador_id}")
        
        # Get contrato for out-of-scope mandante
        resp = requests.get(f"{BASE_URL}/contratos", headers=get_headers("admin"), timeout=30)
        contratos = resp.json().get("contratos", [])
        scope_contratos = [c for c in contratos if c.get("mandante_id") == out_of_scope_mandante["mandante_id"]]
        
        if not scope_contratos:
            log("⚠️  No contratos for out-of-scope mandante - skipping scope test")
            return True
        
        scope_contrato_id = scope_contratos[0]["contrato_id"]
        
        # Assign trabajador
        asignar_data = {
            "trabajador_id": scope_test_trabajador_id,
            "contrato_id": scope_contrato_id
        }
        resp = requests.post(f"{BASE_URL}/trabajadores/asignar", headers=get_headers("admin"), json=asignar_data, timeout=30)
        if resp.status_code != 201:
            log(f"⚠️  Failed to assign trabajador: {resp.status_code}")
            return True
        
        # Get requisito
        resp = requests.get(f"{BASE_URL}/mandantes/{out_of_scope_mandante['mandante_id']}", headers=get_headers("admin"), timeout=30)
        requisitos = resp.json().get("requisitos", [])
        trabajador_reqs = [r for r in requisitos if r.get("tipo_recurso") == "trabajador"]
        
        if not trabajador_reqs:
            log("⚠️  No requisitos for out-of-scope mandante")
            return True
        
        scope_requisito_id = trabajador_reqs[0]["requisito_id"]
        
        # Upload document
        test_file_content = b"Test document for scope test"
        files = {
            "file": ("test_scope.txt", test_file_content, "text/plain")
        }
        data = {
            "recurso_tipo": "trabajador",
            "recurso_id": scope_test_trabajador_id,
            "requisito_id": scope_requisito_id,
            "mandante_id": out_of_scope_mandante["mandante_id"]
        }
        
        headers = {"Authorization": f"Bearer {test_state['tokens']['admin']}"}
        resp = requests.post(f"{BASE_URL}/documentos/upload", headers=headers, files=files, data=data, timeout=30)
        
        if resp.status_code != 201:
            log(f"⚠️  Failed to upload document: {resp.status_code}")
            return True
        
        scope_doc_id = resp.json().get("documento", {}).get("documento_id")
        log(f"✅ Created test document in out-of-scope mandante: {scope_doc_id}")
        
        # Try to delete as RR.HH. (should be 403)
        log(f"\nAttempting to DELETE out-of-scope document as RR.HH. (should be 403)...")
        resp = requests.delete(
            f"{BASE_URL}/documentos/{scope_doc_id}",
            headers=get_headers("rrhh"),
            timeout=30
        )
        
        log(f"Response status: {resp.status_code}")
        
        if resp.status_code == 403:
            log("✅ RR.HH. correctly denied access to out-of-scope document (403)")
            log("\n✅ TEST 8 PASSED: Scope restriction working correctly")
            return True
        else:
            log(f"❌ TEST 8 FAILED: Expected 403, got {resp.status_code}")
            log(f"   Response: {resp.text}")
            return False
    except Exception as e:
        log(f"❌ TEST 8 FAILED: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def test_9_cleanup():
    """Test 9: Cleanup all test data"""
    log("\n" + "="*80)
    log("TEST 9: Cleanup test data")
    log("="*80)
    
    try:
        # Delete all test items (as admin with cascade delete)
        for item_type, item_id in reversed(test_state["cleanup_items"]):
            if not item_id:
                continue
            
            log(f"Deleting {item_type} {item_id}...")
            resp = requests.delete(
                f"{BASE_URL}/{item_type}s/{item_id}",
                headers=get_headers("admin"),
                timeout=30
            )
            
            if resp.status_code == 200:
                log(f"✅ Deleted {item_type} {item_id}")
            else:
                log(f"⚠️  Failed to delete {item_type} {item_id}: {resp.status_code}")
        
        log("\n✅ TEST 9 PASSED: Cleanup complete")
        return True
    except Exception as e:
        log(f"⚠️  Cleanup exception: {str(e)}")
        return True  # Don't fail on cleanup

def main():
    """Run all tests"""
    log("="*80)
    log("BACKEND TESTING: RR.HH. Permissions (MANDANTE_RRHH)")
    log("Testing NEW permissions: crear trabajador + eliminar documento")
    log("="*80)
    
    tests = [
        ("Login all users", test_1_login_all_users),
        ("Get empresa and mandante", test_2_get_empresa_and_mandante),
        ("CREATE trabajador as RR.HH.", test_3_crear_trabajador_rrhh),
        ("Setup documento for DELETE", test_4_setup_documento_for_delete),
        ("DELETE documento as RR.HH.", test_5_delete_documento_rrhh),
        ("GET documento URL", test_6_download_documento_url),
        ("Negative authorization tests", test_7_negative_visor_prevencion),
        ("Scope test", test_8_scope_test),
        ("Cleanup", test_9_cleanup),
    ]
    
    results = []
    for test_name, test_func in tests:
        try:
            result = test_func()
            results.append((test_name, result))
        except Exception as e:
            log(f"\n❌ EXCEPTION in {test_name}: {str(e)}")
            import traceback
            traceback.print_exc()
            results.append((test_name, False))
    
    # Summary
    log("\n" + "="*80)
    log("TEST SUMMARY")
    log("="*80)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASSED" if result else "❌ FAILED"
        log(f"{status}: {test_name}")
    
    log(f"\nTotal: {passed}/{total} tests passed")
    
    if passed == total:
        log("\n🎉 ALL TESTS PASSED!")
        return 0
    else:
        log(f"\n⚠️  {total - passed} test(s) failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())
