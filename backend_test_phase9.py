#!/usr/bin/env python3
"""
PHASE 9 Backend Testing: Categoria field in acreditacion detalle
Test that worker/resource acreditacion detalle now includes 'categoria' field
"""

import requests
import json
import sys
from typing import Dict, Any, Optional, List

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
            log_test("Admin login", False, f"Status: {response.status_code}")
            return None
    except Exception as e:
        log_test("Admin login", False, f"Exception: {str(e)}")
        return None

def test_trabajador_categoria(token: str, trabajador_id: str, trabajador_name: str):
    """Test that trabajador acreditacion detalle has categoria field"""
    print(f"\n=== Testing Trabajador: {trabajador_name} ({trabajador_id}) ===")
    
    try:
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(f"{BASE_URL}/trabajadores/{trabajador_id}", headers=headers, timeout=10)
        
        if response.status_code != 200:
            log_test(f"GET /api/trabajadores/{trabajador_id}", False, f"Status: {response.status_code}")
            return False
        
        log_test(f"GET /api/trabajadores/{trabajador_id}", True, "200 OK")
        
        data = response.json()
        trabajador = data.get("trabajador", {})
        acreditacion = data.get("acreditacion", [])
        
        if not acreditacion:
            log_test(f"Trabajador {trabajador_name} has assignments", False, "No acreditacion array (no assignments)")
            return False
        
        log_test(f"Trabajador {trabajador_name} has assignments", True, f"{len(acreditacion)} mandante(s)")
        
        # Check each mandante's acreditacion
        all_valid = True
        for idx, acred in enumerate(acreditacion):
            mandante = acred.get("mandante", "Unknown")
            detalle = acred.get("detalle", [])
            docs_ok = acred.get("docs_ok")
            docs_total = acred.get("docs_total")
            
            print(f"  Mandante: {mandante}")
            print(f"    Detalle items: {len(detalle)}")
            print(f"    docs_ok: {docs_ok}, docs_total: {docs_total}")
            
            # Verify docs_ok and docs_total are numbers
            if not isinstance(docs_ok, int):
                log_test(f"  {mandante}: docs_ok is number", False, f"Expected int, got {type(docs_ok)}")
                all_valid = False
            else:
                log_test(f"  {mandante}: docs_ok is number", True, f"docs_ok={docs_ok}")
            
            if not isinstance(docs_total, int):
                log_test(f"  {mandante}: docs_total is number", False, f"Expected int, got {type(docs_total)}")
                all_valid = False
            else:
                log_test(f"  {mandante}: docs_total is number", True, f"docs_total={docs_total}")
            
            if not detalle:
                log_test(f"  {mandante}: has detalle items", False, "Detalle array is empty")
                all_valid = False
                continue
            
            log_test(f"  {mandante}: has detalle items", True, f"{len(detalle)} items")
            
            # Check each detalle item for categoria field
            missing_categoria = []
            null_categoria = []
            empty_categoria = []
            valid_categorias = []
            
            for item_idx, item in enumerate(detalle):
                requisito_id = item.get("requisito_id")
                nombre = item.get("nombre", "Unknown")
                categoria = item.get("categoria")
                obligatorio = item.get("obligatorio")
                estado = item.get("estado")
                
                # Check if categoria field exists
                if "categoria" not in item:
                    missing_categoria.append(f"{nombre} (requisito_id: {requisito_id})")
                    all_valid = False
                # Check if categoria is null
                elif categoria is None:
                    null_categoria.append(f"{nombre} (requisito_id: {requisito_id})")
                    all_valid = False
                # Check if categoria is empty string
                elif categoria == "":
                    empty_categoria.append(f"{nombre} (requisito_id: {requisito_id})")
                    all_valid = False
                # Check if categoria is a string
                elif not isinstance(categoria, str):
                    null_categoria.append(f"{nombre} (requisito_id: {requisito_id}, type: {type(categoria)})")
                    all_valid = False
                else:
                    valid_categorias.append(categoria)
                
                # Verify other required fields still exist
                if requisito_id is None:
                    log_test(f"    Item {item_idx+1}: has requisito_id", False, f"Missing requisito_id for {nombre}")
                    all_valid = False
                if nombre is None:
                    log_test(f"    Item {item_idx+1}: has nombre", False, f"Missing nombre")
                    all_valid = False
                if obligatorio is None:
                    log_test(f"    Item {item_idx+1}: has obligatorio", False, f"Missing obligatorio for {nombre}")
                    all_valid = False
                if estado is None:
                    log_test(f"    Item {item_idx+1}: has estado", False, f"Missing estado for {nombre}")
                    all_valid = False
            
            # Report categoria validation results
            if missing_categoria:
                log_test(f"  {mandante}: all detalle items have 'categoria' field", False, 
                        f"Missing categoria in {len(missing_categoria)} items: {', '.join(missing_categoria[:3])}")
            elif null_categoria:
                log_test(f"  {mandante}: all detalle items have non-null 'categoria'", False, 
                        f"Null categoria in {len(null_categoria)} items: {', '.join(null_categoria[:3])}")
            elif empty_categoria:
                log_test(f"  {mandante}: all detalle items have non-empty 'categoria'", False, 
                        f"Empty categoria in {len(empty_categoria)} items: {', '.join(empty_categoria[:3])}")
            else:
                unique_cats = set(valid_categorias)
                log_test(f"  {mandante}: all detalle items have valid 'categoria'", True, 
                        f"{len(detalle)} items with {len(unique_cats)} unique categories: {', '.join(sorted(unique_cats))}")
        
        return all_valid
        
    except Exception as e:
        log_test(f"Test trabajador {trabajador_name}", False, f"Exception: {str(e)}")
        return False

def test_vehiculo_categoria(token: str, vehiculo_id: str, vehiculo_name: str):
    """Test that vehiculo acreditacion detalle has categoria field"""
    print(f"\n=== Testing Vehiculo: {vehiculo_name} ({vehiculo_id}) ===")
    
    try:
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(f"{BASE_URL}/vehiculos/{vehiculo_id}", headers=headers, timeout=10)
        
        if response.status_code != 200:
            log_test(f"GET /api/vehiculos/{vehiculo_id}", False, f"Status: {response.status_code}")
            return False
        
        log_test(f"GET /api/vehiculos/{vehiculo_id}", True, "200 OK")
        
        data = response.json()
        recurso = data.get("recurso", {})
        acreditacion = data.get("acreditacion", [])
        
        if not acreditacion:
            log_test(f"Vehiculo {vehiculo_name} has assignments", False, "No acreditacion array (no assignments)")
            return False
        
        log_test(f"Vehiculo {vehiculo_name} has assignments", True, f"{len(acreditacion)} mandante(s)")
        
        # Check each mandante's acreditacion
        all_valid = True
        for acred in acreditacion:
            mandante = acred.get("mandante", "Unknown")
            detalle = acred.get("detalle", [])
            docs_ok = acred.get("docs_ok")
            docs_total = acred.get("docs_total")
            
            print(f"  Mandante: {mandante}")
            print(f"    Detalle items: {len(detalle)}")
            
            # Verify docs_ok and docs_total are numbers
            if not isinstance(docs_ok, int):
                log_test(f"  {mandante}: docs_ok is number", False, f"Expected int, got {type(docs_ok)}")
                all_valid = False
            if not isinstance(docs_total, int):
                log_test(f"  {mandante}: docs_total is number", False, f"Expected int, got {type(docs_total)}")
                all_valid = False
            
            if not detalle:
                log_test(f"  {mandante}: has detalle items", False, "Detalle array is empty")
                all_valid = False
                continue
            
            # Check each detalle item for categoria field
            valid_categorias = []
            for item in detalle:
                nombre = item.get("nombre", "Unknown")
                categoria = item.get("categoria")
                
                if "categoria" not in item or categoria is None or categoria == "" or not isinstance(categoria, str):
                    log_test(f"  {mandante}: detalle item '{nombre}' has valid categoria", False, 
                            f"categoria={categoria}")
                    all_valid = False
                else:
                    valid_categorias.append(categoria)
            
            if valid_categorias and len(valid_categorias) == len(detalle):
                unique_cats = set(valid_categorias)
                log_test(f"  {mandante}: all detalle items have valid 'categoria'", True, 
                        f"{len(detalle)} items with categories: {', '.join(sorted(unique_cats))}")
        
        return all_valid
        
    except Exception as e:
        log_test(f"Test vehiculo {vehiculo_name}", False, f"Exception: {str(e)}")
        return False

def test_equipo_categoria(token: str, equipo_id: str, equipo_name: str):
    """Test that equipo acreditacion detalle has categoria field"""
    print(f"\n=== Testing Equipo: {equipo_name} ({equipo_id}) ===")
    
    try:
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(f"{BASE_URL}/equipos/{equipo_id}", headers=headers, timeout=10)
        
        if response.status_code != 200:
            log_test(f"GET /api/equipos/{equipo_id}", False, f"Status: {response.status_code}")
            return False
        
        log_test(f"GET /api/equipos/{equipo_id}", True, "200 OK")
        
        data = response.json()
        recurso = data.get("recurso", {})
        acreditacion = data.get("acreditacion", [])
        
        if not acreditacion:
            log_test(f"Equipo {equipo_name} has assignments", False, "No acreditacion array (no assignments)")
            return False
        
        log_test(f"Equipo {equipo_name} has assignments", True, f"{len(acreditacion)} mandante(s)")
        
        # Check each mandante's acreditacion
        all_valid = True
        for acred in acreditacion:
            mandante = acred.get("mandante", "Unknown")
            detalle = acred.get("detalle", [])
            docs_ok = acred.get("docs_ok")
            docs_total = acred.get("docs_total")
            
            print(f"  Mandante: {mandante}")
            print(f"    Detalle items: {len(detalle)}")
            
            # Verify docs_ok and docs_total are numbers
            if not isinstance(docs_ok, int):
                log_test(f"  {mandante}: docs_ok is number", False, f"Expected int, got {type(docs_ok)}")
                all_valid = False
            if not isinstance(docs_total, int):
                log_test(f"  {mandante}: docs_total is number", False, f"Expected int, got {type(docs_total)}")
                all_valid = False
            
            if not detalle:
                log_test(f"  {mandante}: has detalle items", False, "Detalle array is empty")
                all_valid = False
                continue
            
            # Check each detalle item for categoria field
            valid_categorias = []
            for item in detalle:
                nombre = item.get("nombre", "Unknown")
                categoria = item.get("categoria")
                
                if "categoria" not in item or categoria is None or categoria == "" or not isinstance(categoria, str):
                    log_test(f"  {mandante}: detalle item '{nombre}' has valid categoria", False, 
                            f"categoria={categoria}")
                    all_valid = False
                else:
                    valid_categorias.append(categoria)
            
            if valid_categorias and len(valid_categorias) == len(detalle):
                unique_cats = set(valid_categorias)
                log_test(f"  {mandante}: all detalle items have valid 'categoria'", True, 
                        f"{len(detalle)} items with categories: {', '.join(sorted(unique_cats))}")
        
        return all_valid
        
    except Exception as e:
        log_test(f"Test equipo {equipo_name}", False, f"Exception: {str(e)}")
        return False

def test_regression(token: str):
    """Run regression tests"""
    print("\n=== REGRESSION TESTS ===")
    
    try:
        headers = {"Authorization": f"Bearer {token}"}
        
        # Test 1: Health check
        response = requests.get(f"{BASE_URL}/health", timeout=10)
        if response.status_code == 200:
            data = response.json()
            log_test("GET /api/health", True, f"Response: {data}")
        else:
            log_test("GET /api/health", False, f"Status: {response.status_code}")
        
        # Test 2: Login all 4 roles
        roles = [
            ("admin@aptivarl.com", "SUPER_ADMIN_HOLDING"),
            ("empresa@aptivarl.com", "ADMIN_EMPRESA"),
            ("revisor@aptivarl.com", "REVISOR"),
            ("mandante@aptivarl.com", "USUARIO_MANDANTE")
        ]
        
        for email, expected_role in roles:
            response = requests.post(
                f"{BASE_URL}/auth/login",
                json={"email": email, "password": ADMIN_PASSWORD},
                timeout=10
            )
            if response.status_code == 200:
                data = response.json()
                profile = data.get("profile", {})
                role = profile.get("role_codigo")
                if role == expected_role:
                    log_test(f"Login {email}", True, f"Role: {role}")
                else:
                    log_test(f"Login {email}", False, f"Expected role {expected_role}, got {role}")
            else:
                log_test(f"Login {email}", False, f"Status: {response.status_code}")
        
        # Test 3: GET /api/mandantes/:id still returns categorias with docs_count
        response = requests.get(f"{BASE_URL}/mandantes", headers=headers, timeout=10)
        if response.status_code == 200:
            mandantes = response.json().get("mandantes", [])
            if mandantes:
                mandante_id = mandantes[0].get("mandante_id")
                response = requests.get(f"{BASE_URL}/mandantes/{mandante_id}", headers=headers, timeout=10)
                if response.status_code == 200:
                    data = response.json()
                    categorias = data.get("categorias", [])
                    requisitos = data.get("requisitos", [])
                    
                    # Check categorias have docs_count
                    if categorias:
                        cat = categorias[0]
                        if "docs_count" in cat and isinstance(cat.get("docs_count"), int):
                            log_test("Mandante detail: categorias have docs_count", True, 
                                    f"First categoria has docs_count={cat.get('docs_count')}")
                        else:
                            log_test("Mandante detail: categorias have docs_count", False, 
                                    f"Missing or invalid docs_count in categoria")
                    
                    # Check requisitos structure (Estándar Documental unaffected)
                    if requisitos:
                        req = requisitos[0]
                        required_fields = ["requisito_id", "nombre", "obligatorio", "tiene_vencimiento"]
                        missing = [f for f in required_fields if f not in req]
                        if not missing:
                            log_test("Mandante detail: requisitos structure intact", True, 
                                    f"All required fields present")
                        else:
                            log_test("Mandante detail: requisitos structure intact", False, 
                                    f"Missing fields: {missing}")
                else:
                    log_test("GET /api/mandantes/:id", False, f"Status: {response.status_code}")
        
        # Test 4: GET /api/trabajadores count ~320
        response = requests.get(f"{BASE_URL}/trabajadores", headers=headers, timeout=10)
        if response.status_code == 200:
            trabajadores = response.json().get("trabajadores", [])
            count = len(trabajadores)
            if count >= 320:
                log_test("GET /api/trabajadores count", True, f"Count: {count} (>= 320)")
            else:
                log_test("GET /api/trabajadores count", False, f"Count: {count} (expected >= 320)")
        else:
            log_test("GET /api/trabajadores", False, f"Status: {response.status_code}")
        
    except Exception as e:
        log_test("Regression tests", False, f"Exception: {str(e)}")

def main():
    """Main test execution"""
    print("=" * 80)
    print("PHASE 9 BACKEND TESTING: Categoria field in acreditacion detalle")
    print("=" * 80)
    
    # Login
    token = login_admin()
    if not token:
        print("\n❌ FAILED: Could not authenticate")
        sys.exit(1)
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # Get trabajadores with assignments
    print("\n=== Finding trabajadores with assignments ===")
    try:
        response = requests.get(f"{BASE_URL}/trabajadores", headers=headers, timeout=10)
        if response.status_code != 200:
            print(f"❌ Failed to get trabajadores: {response.status_code}")
            sys.exit(1)
        
        trabajadores = response.json().get("trabajadores", [])
        print(f"Found {len(trabajadores)} trabajadores")
        
        # Test first 3 trabajadores (most should have assignments from seed data)
        tested_count = 0
        for trab in trabajadores[:10]:  # Check first 10 to find 3 with assignments
            if tested_count >= 3:
                break
            
            trab_id = trab.get("trabajador_id")
            trab_name = f"{trab.get('nombre', '')} {trab.get('apellido', '')}"
            
            # Quick check if this trabajador has assignments
            response = requests.get(f"{BASE_URL}/trabajadores/{trab_id}", headers=headers, timeout=10)
            if response.status_code == 200:
                data = response.json()
                acreditacion = data.get("acreditacion", [])
                if acreditacion:
                    test_trabajador_categoria(token, trab_id, trab_name)
                    tested_count += 1
        
        if tested_count == 0:
            print("⚠️  WARNING: No trabajadores with assignments found")
        
    except Exception as e:
        print(f"❌ Exception while testing trabajadores: {str(e)}")
    
    # Get vehiculos with assignments
    print("\n=== Finding vehiculos with assignments ===")
    try:
        response = requests.get(f"{BASE_URL}/vehiculos", headers=headers, timeout=10)
        if response.status_code == 200:
            vehiculos = response.json().get("vehiculos", [])
            print(f"Found {len(vehiculos)} vehiculos")
            
            # Test first vehiculo with assignment
            tested_count = 0
            for veh in vehiculos:
                if tested_count >= 1:
                    break
                
                veh_id = veh.get("vehiculo_id")
                veh_name = veh.get("patente", "Unknown")
                
                # Quick check if this vehiculo has assignments
                response = requests.get(f"{BASE_URL}/vehiculos/{veh_id}", headers=headers, timeout=10)
                if response.status_code == 200:
                    data = response.json()
                    acreditacion = data.get("acreditacion", [])
                    if acreditacion:
                        test_vehiculo_categoria(token, veh_id, veh_name)
                        tested_count += 1
            
            if tested_count == 0:
                print("⚠️  NOTE: No vehiculos with assignments found")
        else:
            print(f"⚠️  Could not get vehiculos: {response.status_code}")
    except Exception as e:
        print(f"❌ Exception while testing vehiculos: {str(e)}")
    
    # Get equipos with assignments
    print("\n=== Finding equipos with assignments ===")
    try:
        response = requests.get(f"{BASE_URL}/equipos", headers=headers, timeout=10)
        if response.status_code == 200:
            equipos = response.json().get("equipos", [])
            print(f"Found {len(equipos)} equipos")
            
            # Test first equipo with assignment
            tested_count = 0
            for eq in equipos:
                if tested_count >= 1:
                    break
                
                eq_id = eq.get("equipo_id")
                eq_name = eq.get("codigo_interno", "Unknown")
                
                # Quick check if this equipo has assignments
                response = requests.get(f"{BASE_URL}/equipos/{eq_id}", headers=headers, timeout=10)
                if response.status_code == 200:
                    data = response.json()
                    acreditacion = data.get("acreditacion", [])
                    if acreditacion:
                        test_equipo_categoria(token, eq_id, eq_name)
                        tested_count += 1
            
            if tested_count == 0:
                print("⚠️  NOTE: No equipos with assignments found")
        else:
            print(f"⚠️  Could not get equipos: {response.status_code}")
    except Exception as e:
        print(f"❌ Exception while testing equipos: {str(e)}")
    
    # Run regression tests
    test_regression(token)
    
    # Print summary
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    print(f"✅ Passed: {test_results['passed']}")
    print(f"❌ Failed: {test_results['failed']}")
    print(f"Total: {test_results['passed'] + test_results['failed']}")
    
    if test_results['failed'] > 0:
        print("\n❌ SOME TESTS FAILED")
        sys.exit(1)
    else:
        print("\n✅ ALL TESTS PASSED")
        sys.exit(0)

if __name__ == "__main__":
    main()
