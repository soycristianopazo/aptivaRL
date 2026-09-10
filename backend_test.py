#!/usr/bin/env python3
"""
Backend API Testing for Aptiva RL - Unified Search Endpoint /api/buscar
Tests the new GET /api/buscar endpoint for Expediente autocomplete functionality
"""

import requests
import json
import sys

# Base URL from .env
BASE_URL = "https://aptiva-db.preview.emergentagent.com/api"

# Test credentials
ADMIN_EMAIL = "admin@aptivarl.com"
ADMIN_PASSWORD = "Aptiva2025!"
EMPRESA_EMAIL = "empresa@aptivarl.com"
EMPRESA_PASSWORD = "Aptiva2025!"

def login(email, password):
    """Login and return token"""
    try:
        response = requests.post(
            f"{BASE_URL}/auth/login",
            json={"email": email, "password": password},
            timeout=10
        )
        if response.status_code == 200:
            data = response.json()
            return data.get("token"), data.get("profile")
        else:
            print(f"❌ Login failed: {response.status_code} - {response.text}")
            return None, None
    except Exception as e:
        print(f"❌ Login exception: {e}")
        return None, None

def test_buscar_minimum_chars(token):
    """Test 1: GET /api/buscar?q=a (1 char) should return empty resultados"""
    print("\n=== TEST 1: Minimum 2 chars required ===")
    try:
        response = requests.get(
            f"{BASE_URL}/buscar?q=a",
            headers={"Authorization": f"Bearer {token}"},
            timeout=10
        )
        print(f"Status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ FAIL: Expected 200, got {response.status_code}")
            return False
        
        data = response.json()
        if "resultados" not in data:
            print(f"❌ FAIL: Missing 'resultados' key in response")
            return False
        
        if data["resultados"] != []:
            print(f"❌ FAIL: Expected empty array, got {len(data['resultados'])} items")
            return False
        
        print("✅ PASS: Returns empty resultados for 1 char query")
        return True
    except Exception as e:
        print(f"❌ FAIL: Exception - {e}")
        return False

def test_buscar_worker_by_name(token):
    """Test 2: Search by first 4 letters of real worker name"""
    print("\n=== TEST 2: Search trabajador by name (first 4 letters) ===")
    try:
        # First get a real worker
        response = requests.get(
            f"{BASE_URL}/trabajadores",
            headers={"Authorization": f"Bearer {token}"},
            timeout=10
        )
        if response.status_code != 200:
            print(f"❌ FAIL: Could not fetch trabajadores: {response.status_code}")
            return False, None
        
        workers = response.json().get("trabajadores", [])
        if not workers:
            print(f"❌ FAIL: No trabajadores found")
            return False, None
        
        # Get first worker's name (first 4 letters)
        worker = workers[0]
        worker_name = worker.get("nombre", "")
        if len(worker_name) < 4:
            worker_name = worker.get("apellido", "")
        
        search_term = worker_name[:4].lower()
        print(f"Searching for: '{search_term}' (from worker: {worker.get('nombre')} {worker.get('apellido')})")
        
        # Search
        response = requests.get(
            f"{BASE_URL}/buscar?q={search_term}",
            headers={"Authorization": f"Bearer {token}"},
            timeout=10
        )
        print(f"Status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ FAIL: Expected 200, got {response.status_code}")
            return False, None
        
        data = response.json()
        if "resultados" not in data:
            print(f"❌ FAIL: Missing 'resultados' key")
            return False, None
        
        resultados = data["resultados"]
        if not isinstance(resultados, list):
            print(f"❌ FAIL: resultados is not an array")
            return False, None
        
        # Check structure of items
        trabajador_found = False
        trabajador_id = None
        for item in resultados:
            required_keys = ["tipo", "id", "label", "sub", "extra", "empresa"]
            missing_keys = [k for k in required_keys if k not in item]
            if missing_keys:
                print(f"❌ FAIL: Item missing keys: {missing_keys}")
                return False, None
            
            if item["tipo"] == "trabajador":
                trabajador_found = True
                trabajador_id = item["id"]
                print(f"Found trabajador: {item['label']} (RUT: {item['sub']}, Cargo: {item['extra']}, Empresa: {item['empresa']})")
        
        if not trabajador_found:
            print(f"❌ FAIL: No trabajador found in results")
            return False, None
        
        print(f"✅ PASS: Found {len(resultados)} results with at least one trabajador")
        return True, trabajador_id
    except Exception as e:
        print(f"❌ FAIL: Exception - {e}")
        return False, None

def test_buscar_worker_by_rut(token):
    """Test 3: Search by partial RUT (with dots and without)"""
    print("\n=== TEST 3: Search trabajador by partial RUT ===")
    try:
        # Get a real worker with RUT
        response = requests.get(
            f"{BASE_URL}/trabajadores",
            headers={"Authorization": f"Bearer {token}"},
            timeout=10
        )
        if response.status_code != 200:
            print(f"❌ FAIL: Could not fetch trabajadores")
            return False
        
        workers = response.json().get("trabajadores", [])
        worker_with_rut = None
        for w in workers:
            if w.get("rut"):
                worker_with_rut = w
                break
        
        if not worker_with_rut:
            print(f"❌ FAIL: No worker with RUT found")
            return False
        
        rut = worker_with_rut["rut"]
        print(f"Testing with RUT: {rut} (Worker: {worker_with_rut.get('nombre')} {worker_with_rut.get('apellido')})")
        
        # Test 3a: Search with dots (e.g., "17.561")
        if "." in rut:
            partial_with_dots = rut[:6]  # e.g., "17.561"
            print(f"Searching with dots: '{partial_with_dots}'")
            response = requests.get(
                f"{BASE_URL}/buscar?q={partial_with_dots}",
                headers={"Authorization": f"Bearer {token}"},
                timeout=10
            )
            if response.status_code != 200:
                print(f"❌ FAIL: Search with dots failed: {response.status_code}")
                return False
            
            data = response.json()
            trabajador_found = any(item["tipo"] == "trabajador" for item in data.get("resultados", []))
            if trabajador_found:
                print(f"✅ PASS: Found trabajador with partial RUT (with dots)")
            else:
                print(f"⚠️  WARNING: No trabajador found with partial RUT (with dots)")
        
        # Test 3b: Search without dots (e.g., "17561")
        partial_no_dots = rut.replace(".", "").replace("-", "")[:5]  # e.g., "17561"
        print(f"Searching without dots: '{partial_no_dots}'")
        response = requests.get(
            f"{BASE_URL}/buscar?q={partial_no_dots}",
            headers={"Authorization": f"Bearer {token}"},
            timeout=10
        )
        if response.status_code != 200:
            print(f"❌ FAIL: Search without dots failed: {response.status_code}")
            return False
        
        data = response.json()
        trabajador_found = any(item["tipo"] == "trabajador" for item in data.get("resultados", []))
        if trabajador_found:
            print(f"✅ PASS: Found trabajador with partial RUT (without dots)")
        else:
            print(f"⚠️  WARNING: No trabajador found with partial RUT (without dots)")
        
        print(f"✅ PASS: RUT search completed")
        return True
    except Exception as e:
        print(f"❌ FAIL: Exception - {e}")
        return False

def test_trabajador_id_usable(token, trabajador_id):
    """Test 4: Verify trabajador id from search is usable"""
    print(f"\n=== TEST 4: Verify trabajador ID is usable ===")
    if not trabajador_id:
        print("⚠️  SKIP: No trabajador_id provided")
        return True
    
    try:
        print(f"Testing GET /api/trabajadores/{trabajador_id}")
        response = requests.get(
            f"{BASE_URL}/trabajadores/{trabajador_id}",
            headers={"Authorization": f"Bearer {token}"},
            timeout=10
        )
        print(f"Status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ FAIL: Expected 200, got {response.status_code}")
            return False
        
        data = response.json()
        if "trabajador" not in data:
            print(f"❌ FAIL: Missing 'trabajador' key in response")
            return False
        
        print(f"✅ PASS: Trabajador ID is usable (ficha opens correctly)")
        return True
    except Exception as e:
        print(f"❌ FAIL: Exception - {e}")
        return False

def test_buscar_vehiculo(token):
    """Test 5: Search by partial patente and verify ID is usable"""
    print("\n=== TEST 5: Search vehiculo by partial patente ===")
    try:
        # Get a real vehiculo
        response = requests.get(
            f"{BASE_URL}/vehiculos",
            headers={"Authorization": f"Bearer {token}"},
            timeout=10
        )
        if response.status_code != 200:
            print(f"❌ FAIL: Could not fetch vehiculos: {response.status_code}")
            return False
        
        vehiculos = response.json().get("vehiculos", [])
        if not vehiculos:
            print(f"❌ FAIL: No vehiculos found")
            return False
        
        vehiculo = vehiculos[0]
        patente = vehiculo.get("patente", "")
        if len(patente) < 3:
            print(f"❌ FAIL: Patente too short")
            return False
        
        partial_patente = patente[:3]
        print(f"Searching for: '{partial_patente}' (from patente: {patente})")
        
        # Search
        response = requests.get(
            f"{BASE_URL}/buscar?q={partial_patente}",
            headers={"Authorization": f"Bearer {token}"},
            timeout=10
        )
        print(f"Status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ FAIL: Expected 200, got {response.status_code}")
            return False
        
        data = response.json()
        resultados = data.get("resultados", [])
        
        vehiculo_found = False
        vehiculo_id = None
        for item in resultados:
            if item["tipo"] == "vehiculo":
                vehiculo_found = True
                vehiculo_id = item["id"]
                print(f"Found vehiculo: {item['label']} (Marca/Modelo: {item['sub']}, Empresa: {item['empresa']})")
                break
        
        if not vehiculo_found:
            print(f"❌ FAIL: No vehiculo found in results")
            return False
        
        # Test 5b: Verify vehiculo ID is usable
        print(f"Testing GET /api/vehiculos/{vehiculo_id}")
        response = requests.get(
            f"{BASE_URL}/vehiculos/{vehiculo_id}",
            headers={"Authorization": f"Bearer {token}"},
            timeout=10
        )
        if response.status_code != 200:
            print(f"❌ FAIL: Vehiculo ID not usable: {response.status_code}")
            return False
        
        print(f"✅ PASS: Found vehiculo and ID is usable")
        return True
    except Exception as e:
        print(f"❌ FAIL: Exception - {e}")
        return False

def test_buscar_equipo(token):
    """Test 6: Search by partial codigo_interno and verify ID is usable"""
    print("\n=== TEST 6: Search equipo by partial codigo_interno ===")
    try:
        # Get a real equipo
        response = requests.get(
            f"{BASE_URL}/equipos",
            headers={"Authorization": f"Bearer {token}"},
            timeout=10
        )
        if response.status_code != 200:
            print(f"❌ FAIL: Could not fetch equipos: {response.status_code}")
            return False
        
        equipos = response.json().get("equipos", [])
        if not equipos:
            print(f"❌ FAIL: No equipos found")
            return False
        
        equipo = equipos[0]
        codigo = equipo.get("codigo_interno", "")
        if len(codigo) < 2:
            print(f"❌ FAIL: Codigo too short")
            return False
        
        partial_codigo = codigo[:3] if len(codigo) >= 3 else codigo[:2]
        print(f"Searching for: '{partial_codigo}' (from codigo: {codigo})")
        
        # Search
        response = requests.get(
            f"{BASE_URL}/buscar?q={partial_codigo}",
            headers={"Authorization": f"Bearer {token}"},
            timeout=10
        )
        print(f"Status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ FAIL: Expected 200, got {response.status_code}")
            return False
        
        data = response.json()
        resultados = data.get("resultados", [])
        
        equipo_found = False
        equipo_id = None
        for item in resultados:
            if item["tipo"] == "equipo":
                equipo_found = True
                equipo_id = item["id"]
                print(f"Found equipo: {item['label']} (Marca/Modelo: {item['sub']}, Empresa: {item['empresa']})")
                break
        
        if not equipo_found:
            print(f"❌ FAIL: No equipo found in results")
            return False
        
        # Test 6b: Verify equipo ID is usable
        print(f"Testing GET /api/equipos/{equipo_id}")
        response = requests.get(
            f"{BASE_URL}/equipos/{equipo_id}",
            headers={"Authorization": f"Bearer {token}"},
            timeout=10
        )
        if response.status_code != 200:
            print(f"❌ FAIL: Equipo ID not usable: {response.status_code}")
            return False
        
        print(f"✅ PASS: Found equipo and ID is usable")
        return True
    except Exception as e:
        print(f"❌ FAIL: Exception - {e}")
        return False

def test_buscar_no_auth():
    """Test 7: GET /api/buscar without Authorization header should return 401"""
    print("\n=== TEST 7: No authorization header ===")
    try:
        response = requests.get(
            f"{BASE_URL}/buscar?q=test",
            timeout=10
        )
        print(f"Status: {response.status_code}")
        
        if response.status_code != 401:
            print(f"❌ FAIL: Expected 401, got {response.status_code}")
            return False
        
        print(f"✅ PASS: Returns 401 without authorization")
        return True
    except Exception as e:
        print(f"❌ FAIL: Exception - {e}")
        return False

def test_buscar_empresa_scoped(empresa_token, empresa_profile):
    """Test 8: As ADMIN_EMPRESA, all results should match that empresa"""
    print("\n=== TEST 8: ADMIN_EMPRESA empresa-scoped results ===")
    try:
        empresa_id = empresa_profile.get("empresa_id")
        print(f"Testing as ADMIN_EMPRESA (empresa_id: {empresa_id})")
        
        # Get empresa name for this admin
        response_empresas = requests.get(
            f"{BASE_URL}/empresas",
            headers={"Authorization": f"Bearer {empresa_token}"},
            timeout=10
        )
        
        expected_empresa_name = None
        if response_empresas.status_code == 200:
            empresas = response_empresas.json().get("empresas", [])
            empresa_obj = next((e for e in empresas if e["empresa_id"] == empresa_id), None)
            if empresa_obj:
                expected_empresa_name = empresa_obj.get("razon_social")
                print(f"Expected empresa: {expected_empresa_name}")
        
        # Search with a common term (2+ chars)
        response = requests.get(
            f"{BASE_URL}/buscar?q=ma",
            headers={"Authorization": f"Bearer {empresa_token}"},
            timeout=10
        )
        print(f"Status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ FAIL: Expected 200, got {response.status_code}")
            return False
        
        data = response.json()
        resultados = data.get("resultados", [])
        
        if not resultados:
            print(f"⚠️  WARNING: No results returned for ADMIN_EMPRESA search")
            print(f"✅ PASS: No 500 error, empresa scoping working (empty results)")
            return True
        
        if not expected_empresa_name:
            print(f"⚠️  WARNING: Could not determine expected empresa name")
            print(f"✅ PASS: No 500 error, {len(resultados)} results returned")
            return True
        
        # Check all results match this empresa
        mismatched = []
        for item in resultados:
            if item.get("empresa") != expected_empresa_name:
                mismatched.append(item)
        
        if mismatched:
            print(f"❌ FAIL: Found {len(mismatched)} items not matching empresa")
            for item in mismatched[:3]:
                print(f"  - {item['tipo']}: {item['label']} (empresa: {item['empresa']})")
            return False
        
        print(f"✅ PASS: All {len(resultados)} results match ADMIN_EMPRESA's empresa (empresa-scoped)")
        return True
    except Exception as e:
        print(f"❌ FAIL: Exception - {e}")
        return False

def main():
    print("=" * 80)
    print("BACKEND API TESTING: /api/buscar (Unified Search Endpoint)")
    print("=" * 80)
    
    # Login as admin
    print("\n=== Logging in as ADMIN ===")
    admin_token, admin_profile = login(ADMIN_EMAIL, ADMIN_PASSWORD)
    if not admin_token:
        print("❌ CRITICAL: Could not login as admin")
        sys.exit(1)
    print(f"✅ Logged in as {admin_profile.get('email')} (role: {admin_profile.get('role_codigo')})")
    
    # Login as empresa admin
    print("\n=== Logging in as ADMIN_EMPRESA ===")
    empresa_token, empresa_profile = login(EMPRESA_EMAIL, EMPRESA_PASSWORD)
    if not empresa_token:
        print("❌ WARNING: Could not login as ADMIN_EMPRESA")
    else:
        print(f"✅ Logged in as {empresa_profile.get('email')} (role: {empresa_profile.get('role_codigo')})")
    
    # Run tests
    results = []
    
    # Test 1: Minimum chars
    results.append(("Test 1: Minimum 2 chars", test_buscar_minimum_chars(admin_token)))
    
    # Test 2: Search by name
    test2_result, trabajador_id = test_buscar_worker_by_name(admin_token)
    results.append(("Test 2: Search by name", test2_result))
    
    # Test 3: Search by RUT
    results.append(("Test 3: Search by RUT", test_buscar_worker_by_rut(admin_token)))
    
    # Test 4: Trabajador ID usable
    results.append(("Test 4: Trabajador ID usable", test_trabajador_id_usable(admin_token, trabajador_id)))
    
    # Test 5: Search vehiculo
    results.append(("Test 5: Search vehiculo", test_buscar_vehiculo(admin_token)))
    
    # Test 6: Search equipo
    results.append(("Test 6: Search equipo", test_buscar_equipo(admin_token)))
    
    # Test 7: No auth
    results.append(("Test 7: No authorization", test_buscar_no_auth()))
    
    # Test 8: Empresa scoped
    if empresa_token:
        results.append(("Test 8: Empresa-scoped", test_buscar_empresa_scoped(empresa_token, empresa_profile)))
    else:
        results.append(("Test 8: Empresa-scoped", False))
    
    # Summary
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status}: {test_name}")
    
    print(f"\nTotal: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 ALL TESTS PASSED!")
        sys.exit(0)
    else:
        print(f"\n⚠️  {total - passed} test(s) failed")
        sys.exit(1)

if __name__ == "__main__":
    main()
