#!/usr/bin/env python3
"""
PHASE 8 Backend Testing: RUT validator, Title Case, and deduped empresas
Test all backend APIs for Aptiva RL platform
"""

import requests
import json
import sys
from typing import Dict, Any, Optional

# Base URL from .env
BASE_URL = "https://aptiva-db.preview.emergentagent.com/api"

# Admin credentials
ADMIN_EMAIL = "admin@aptivarl.com"
ADMIN_PASSWORD = "Aptiva2025!"

# Test results tracking
test_results = {
    "passed": 0,
    "failed": 0,
    "tests": []
}

# Store created trabajador IDs for cleanup
created_trabajadores = []

def log_test(name: str, passed: bool, details: str = ""):
    """Log test result"""
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"{status}: {name}")
    if details:
        print(f"  Details: {details}")
    
    test_results["tests"].append({
        "name": name,
        "passed": passed,
        "details": details
    })
    
    if passed:
        test_results["passed"] += 1
    else:
        test_results["failed"] += 1

def login_admin() -> Optional[str]:
    """Login as admin and return token"""
    try:
        print("\n=== AUTHENTICATION ===")
        response = requests.post(
            f"{BASE_URL}/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            token = data.get("token")
            profile = data.get("profile", {})
            log_test("Admin login", True, f"Role: {profile.get('role_codigo')}")
            return token
        else:
            log_test("Admin login", False, f"Status: {response.status_code}, Response: {response.text}")
            return None
    except Exception as e:
        log_test("Admin login", False, f"Exception: {str(e)}")
        return None

def test_empresas_dedup(token: str):
    """Test 1: EMPRESAS DEDUP - expect exactly 3 empresas with unique names"""
    print("\n=== TEST 1: EMPRESAS DEDUPLICATION ===")
    try:
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(f"{BASE_URL}/empresas", headers=headers, timeout=10)
        
        if response.status_code != 200:
            log_test("GET /api/empresas status", False, f"Expected 200, got {response.status_code}")
            return None
        
        log_test("GET /api/empresas status", True, "200 OK")
        
        data = response.json()
        empresas = data.get("empresas", [])
        
        # Check count
        count = len(empresas)
        log_test("Empresas count", count == 3, f"Expected 3, got {count}")
        
        # Check for duplicate names
        names = [e.get("razon_social") for e in empresas]
        unique_names = set(names)
        
        has_duplicates = len(names) != len(unique_names)
        log_test("No duplicate empresa names", not has_duplicates, 
                f"Names: {names}, Unique: {list(unique_names)}")
        
        if empresas:
            print(f"  Empresas found: {', '.join(names)}")
            return empresas[0].get("empresa_id")  # Return first empresa_id for later use
        
        return None
        
    except Exception as e:
        log_test("GET /api/empresas", False, f"Exception: {str(e)}")
        return None

def test_rut_invalid(token: str, empresa_id: str):
    """Test 2: RUT INVALID - test various invalid RUTs"""
    print("\n=== TEST 2: RUT VALIDATION (INVALID) ===")
    headers = {"Authorization": f"Bearer {token}"}
    
    invalid_ruts = [
        ("12345678-9", "DV of 12345678 is 5, not 9"),
        ("22222222-3", "DV of 22222222 is 2, not 3"),
        ("abc", "Not a valid RUT format"),
        ("", "Empty RUT"),
    ]
    
    for rut, reason in invalid_ruts:
        try:
            payload = {
                "empresa_id": empresa_id,
                "rut": rut,
                "nombre": "Juan",
                "apellido": "Perez",
                "cargo": "Operador"
            }
            
            response = requests.post(
                f"{BASE_URL}/trabajadores",
                headers=headers,
                json=payload,
                timeout=10
            )
            
            if response.status_code == 400:
                error_msg = response.json().get("error", "")
                # For empty RUT, "Faltan campos obligatorios" is also acceptable
                has_rut_error = "RUT" in error_msg or "rut" in error_msg.lower() or "Faltan campos" in error_msg
                log_test(f"Invalid RUT '{rut}' rejected", has_rut_error, 
                        f"Status: 400, Error: {error_msg}, Reason: {reason}")
            else:
                log_test(f"Invalid RUT '{rut}' rejected", False, 
                        f"Expected 400, got {response.status_code}, Reason: {reason}")
                
        except Exception as e:
            log_test(f"Invalid RUT '{rut}' test", False, f"Exception: {str(e)}")

def compute_rut_dv(body: str) -> str:
    """Compute Chilean RUT DV using módulo 11"""
    suma = 0
    mul = 2
    for digit in reversed(body):
        suma += int(digit) * mul
        mul = 2 if mul == 7 else mul + 1
    res = 11 - (suma % 11)
    if res == 11:
        return '0'
    elif res == 10:
        return 'K'
    else:
        return str(res)

def test_rut_valid_title_case(token: str, empresa_id: str):
    """Test 3: RUT VALID + TITLE CASE - create worker with valid RUT and lowercase names"""
    print("\n=== TEST 3: VALID RUT + TITLE CASE ===")
    headers = {"Authorization": f"Bearer {token}"}
    
    # Use a unique valid RUT: 23456789-X (compute DV)
    rut_body = "23456789"
    rut_dv = compute_rut_dv(rut_body)
    valid_rut = f"{rut_body}-{rut_dv}"
    
    print(f"  Using valid RUT: {valid_rut} (computed DV: {rut_dv})")
    
    try:
        payload = {
            "empresa_id": empresa_id,
            "rut": valid_rut,
            "nombre": "juan carlos",
            "apellido": "PEREZ SOTO",
            "cargo": "operador de grua"
        }
        
        response = requests.post(
            f"{BASE_URL}/trabajadores",
            headers=headers,
            json=payload,
            timeout=10
        )
        
        if response.status_code != 201:
            log_test("Create worker with valid RUT", False, 
                    f"Expected 201, got {response.status_code}, Response: {response.text}")
            return None
        
        log_test("Create worker with valid RUT", True, "201 Created")
        
        data = response.json()
        trabajador = data.get("trabajador", {})
        trabajador_id = trabajador.get("trabajador_id")
        
        if trabajador_id:
            created_trabajadores.append(trabajador_id)
        
        # Verify Title Case
        nombre = trabajador.get("nombre")
        apellido = trabajador.get("apellido")
        cargo = trabajador.get("cargo")
        rut_returned = trabajador.get("rut")
        
        log_test("Title Case - nombre", nombre == "Juan Carlos", 
                f"Expected 'Juan Carlos', got '{nombre}'")
        log_test("Title Case - apellido", apellido == "Perez Soto", 
                f"Expected 'Perez Soto', got '{apellido}'")
        log_test("Title Case - cargo", cargo == "Operador De Grua", 
                f"Expected 'Operador De Grua', got '{cargo}'")
        
        # Verify RUT formatting (should be XX.XXX.XXX-D)
        expected_rut = f"{rut_body[0:2]}.{rut_body[2:5]}.{rut_body[5:8]}-{rut_dv}"
        log_test("RUT formatting", rut_returned == expected_rut, 
                f"Expected '{expected_rut}', got '{rut_returned}'")
        
        return trabajador_id, valid_rut
        
    except Exception as e:
        log_test("Create worker with valid RUT", False, f"Exception: {str(e)}")
        return None, None

def test_rut_with_k(token: str, empresa_id: str):
    """Test 4: RUT with K as DV"""
    print("\n=== TEST 4: RUT WITH K AS DV ===")
    headers = {"Authorization": f"Bearer {token}"}
    
    # Use a RUT where DV is K: 12345670-K (computed: suma=122, 122%11=1, 11-1=10=K)
    rut_body = "12345670"
    rut_dv = compute_rut_dv(rut_body)
    valid_rut_k = f"{rut_body}-{rut_dv}"
    
    print(f"  Using RUT: {valid_rut_k} (computed DV: {rut_dv})")
    
    try:
        payload = {
            "empresa_id": empresa_id,
            "rut": valid_rut_k,
            "nombre": "Maria",
            "apellido": "Lopez",
            "cargo": "Supervisor"
        }
        
        response = requests.post(
            f"{BASE_URL}/trabajadores",
            headers=headers,
            json=payload,
            timeout=10
        )
        
        if rut_dv == 'K':
            # Should be valid
            if response.status_code == 201:
                log_test(f"Valid RUT with K '{valid_rut_k}' accepted", True, "201 Created")
                data = response.json()
                trabajador_id = data.get("trabajador", {}).get("trabajador_id")
                if trabajador_id:
                    created_trabajadores.append(trabajador_id)
                
                # Verify RUT formatting
                rut_returned = data.get("trabajador", {}).get("rut")
                expected_rut = f"{rut_body[0:2]}.{rut_body[2:5]}.{rut_body[5:8]}-K"
                log_test("RUT with K formatting", rut_returned == expected_rut, 
                        f"Expected '{expected_rut}', got '{rut_returned}'")
            else:
                log_test(f"Valid RUT with K '{valid_rut_k}' accepted", False, 
                        f"Expected 201, got {response.status_code}")
        else:
            # Should be invalid
            if response.status_code == 400:
                log_test(f"Invalid RUT '{valid_rut_k}' rejected", True, "400 Bad Request")
            else:
                log_test(f"Invalid RUT '{valid_rut_k}' rejected", False, 
                        f"Expected 400, got {response.status_code}")
                
    except Exception as e:
        log_test("RUT with K test", False, f"Exception: {str(e)}")

def test_duplicate_rut(token: str, empresa_id: str, existing_rut: str):
    """Test 5: DUPLICATE RUT - try to create worker with same RUT"""
    print("\n=== TEST 5: DUPLICATE RUT ===")
    headers = {"Authorization": f"Bearer {token}"}
    
    # Use the same valid RUT from test 3
    if not existing_rut:
        log_test("Duplicate RUT test", False, "No existing RUT to test")
        return
    
    print(f"  Attempting to create duplicate with RUT: {existing_rut}")
    
    try:
        payload = {
            "empresa_id": empresa_id,
            "rut": existing_rut,
            "nombre": "Pedro",
            "apellido": "Gonzalez",
            "cargo": "Tecnico"
        }
        
        response = requests.post(
            f"{BASE_URL}/trabajadores",
            headers=headers,
            json=payload,
            timeout=10
        )
        
        if response.status_code == 409:
            error_msg = response.json().get("error", "")
            log_test("Duplicate RUT rejected", True, f"Status: 409, Error: {error_msg}")
        else:
            log_test("Duplicate RUT rejected", False, 
                    f"Expected 409, got {response.status_code}, Response: {response.text}")
            
    except Exception as e:
        log_test("Duplicate RUT test", False, f"Exception: {str(e)}")

def test_title_case_on_edit(token: str, trabajador_id: str):
    """Test 6: TITLE CASE on edit - PUT with lowercase names"""
    print("\n=== TEST 6: TITLE CASE ON EDIT ===")
    headers = {"Authorization": f"Bearer {token}"}
    
    if not trabajador_id:
        log_test("Title Case on edit", False, "No trabajador_id available")
        return
    
    try:
        payload = {
            "nombre": "maría josé",
            "cargo": "jefe de turno"
        }
        
        response = requests.put(
            f"{BASE_URL}/trabajadores/{trabajador_id}",
            headers=headers,
            json=payload,
            timeout=10
        )
        
        if response.status_code != 200:
            log_test("PUT /api/trabajadores/:id status", False, 
                    f"Expected 200, got {response.status_code}, Response: {response.text}")
            return
        
        log_test("PUT /api/trabajadores/:id status", True, "200 OK")
        
        data = response.json()
        trabajador = data.get("trabajador", {})
        
        nombre = trabajador.get("nombre")
        cargo = trabajador.get("cargo")
        
        log_test("Title Case on edit - nombre", nombre == "María José", 
                f"Expected 'María José', got '{nombre}'")
        log_test("Title Case on edit - cargo", cargo == "Jefe De Turno", 
                f"Expected 'Jefe De Turno', got '{cargo}'")
        
    except Exception as e:
        log_test("Title Case on edit", False, f"Exception: {str(e)}")

def test_regression(token: str):
    """Test 7: Regression tests"""
    print("\n=== TEST 7: REGRESSION TESTS ===")
    headers = {"Authorization": f"Bearer {token}"}
    
    # Health check
    try:
        response = requests.get(f"{BASE_URL}/health", timeout=10)
        log_test("GET /api/health", response.status_code == 200, 
                f"Status: {response.status_code}")
    except Exception as e:
        log_test("GET /api/health", False, f"Exception: {str(e)}")
    
    # Login 4 roles
    roles = [
        ("admin@aptivarl.com", "Aptiva2025!", "SUPER_ADMIN_HOLDING"),
        ("empresa@aptivarl.com", "Aptiva2025!", "ADMIN_EMPRESA"),
        ("revisor@aptivarl.com", "Aptiva2025!", "REVISOR"),
        ("mandante@aptivarl.com", "Aptiva2025!", "USUARIO_MANDANTE"),
    ]
    
    for email, password, expected_role in roles:
        try:
            response = requests.post(
                f"{BASE_URL}/auth/login",
                json={"email": email, "password": password},
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                role = data.get("profile", {}).get("role_codigo")
                log_test(f"Login {email}", role == expected_role, 
                        f"Expected role '{expected_role}', got '{role}'")
            else:
                log_test(f"Login {email}", False, f"Status: {response.status_code}")
        except Exception as e:
            log_test(f"Login {email}", False, f"Exception: {str(e)}")
    
    # GET /api/mandantes count
    try:
        response = requests.get(f"{BASE_URL}/mandantes", headers=headers, timeout=10)
        if response.status_code == 200:
            data = response.json()
            mandantes = data.get("mandantes", [])
            count = len(mandantes)
            log_test("GET /api/mandantes count", count >= 14, 
                    f"Expected >= 14, got {count}")
        else:
            log_test("GET /api/mandantes", False, f"Status: {response.status_code}")
    except Exception as e:
        log_test("GET /api/mandantes", False, f"Exception: {str(e)}")
    
    # GET /api/trabajadores - check Title Case on existing workers
    try:
        response = requests.get(f"{BASE_URL}/trabajadores", headers=headers, timeout=10)
        if response.status_code == 200:
            data = response.json()
            trabajadores = data.get("trabajadores", [])
            count = len(trabajadores)
            log_test("GET /api/trabajadores count", count >= 320, 
                    f"Expected >= 320, got {count}")
            
            # Spot check a few workers for Title Case (not ALL CAPS)
            if trabajadores:
                sample_size = min(5, len(trabajadores))
                all_title_case = True
                for i in range(sample_size):
                    t = trabajadores[i]
                    nombre = t.get("nombre", "")
                    apellido = t.get("apellido", "")
                    
                    # Check if not ALL CAPS (Title Case should have lowercase letters)
                    if nombre == nombre.upper() or apellido == apellido.upper():
                        all_title_case = False
                        print(f"  Found ALL CAPS: {nombre} {apellido}")
                        break
                
                log_test("Trabajadores have Title Case names", all_title_case, 
                        f"Spot checked {sample_size} workers")
        else:
            log_test("GET /api/trabajadores", False, f"Status: {response.status_code}")
    except Exception as e:
        log_test("GET /api/trabajadores", False, f"Exception: {str(e)}")

def cleanup_trabajadores(token: str):
    """Test 8: CLEANUP - delete created trabajadores"""
    print("\n=== TEST 8: CLEANUP ===")
    headers = {"Authorization": f"Bearer {token}"}
    
    if not created_trabajadores:
        print("  No trabajadores to clean up")
        return
    
    print(f"  Cleaning up {len(created_trabajadores)} trabajadores...")
    
    for trabajador_id in created_trabajadores:
        try:
            response = requests.delete(
                f"{BASE_URL}/trabajadores/{trabajador_id}",
                headers=headers,
                timeout=10
            )
            
            if response.status_code == 200:
                log_test(f"DELETE trabajador {trabajador_id[:8]}...", True, "200 OK")
            else:
                log_test(f"DELETE trabajador {trabajador_id[:8]}...", False, 
                        f"Status: {response.status_code}")
        except Exception as e:
            log_test(f"DELETE trabajador {trabajador_id[:8]}...", False, 
                    f"Exception: {str(e)}")

def print_summary():
    """Print test summary"""
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    print(f"Total tests: {test_results['passed'] + test_results['failed']}")
    print(f"Passed: {test_results['passed']} ✅")
    print(f"Failed: {test_results['failed']} ❌")
    print("="*80)
    
    if test_results['failed'] > 0:
        print("\nFailed tests:")
        for test in test_results['tests']:
            if not test['passed']:
                print(f"  ❌ {test['name']}")
                if test['details']:
                    print(f"     {test['details']}")

def main():
    """Main test execution"""
    print("="*80)
    print("PHASE 8 BACKEND TESTING: RUT Validator + Title Case + Deduped Empresas")
    print("="*80)
    
    # Login
    token = login_admin()
    if not token:
        print("\n❌ CRITICAL: Failed to login as admin. Cannot proceed with tests.")
        sys.exit(1)
    
    # Test 1: Empresas dedup
    empresa_id = test_empresas_dedup(token)
    if not empresa_id:
        print("\n⚠️  WARNING: No empresa_id available. Some tests may be skipped.")
        empresa_id = "dummy-id"  # Continue with dummy ID
    
    # Test 2: Invalid RUTs
    test_rut_invalid(token, empresa_id)
    
    # Test 3: Valid RUT + Title Case
    trabajador_id, created_rut = test_rut_valid_title_case(token, empresa_id)
    
    # Test 4: RUT with K
    test_rut_with_k(token, empresa_id)
    
    # Test 5: Duplicate RUT
    test_duplicate_rut(token, empresa_id, created_rut)
    
    # Test 6: Title Case on edit
    test_title_case_on_edit(token, trabajador_id)
    
    # Test 7: Regression
    test_regression(token)
    
    # Test 8: Cleanup
    cleanup_trabajadores(token)
    
    # Print summary
    print_summary()
    
    # Exit with appropriate code
    if test_results['failed'] > 0:
        sys.exit(1)
    else:
        sys.exit(0)

if __name__ == "__main__":
    main()
