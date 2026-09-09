#!/usr/bin/env python3
"""
Phase 4 Focused Backend Tests for Aptiva RL
Tests dashboard filters and notificaciones endpoint
"""
import requests
import json
import time

BASE_URL = "https://aptiva-db.preview.emergentagent.com/api"
ADMIN_EMAIL = "admin@aptivarl.com"
ADMIN_PASSWORD = "Aptiva2025!"

def log_test(name, passed, details=""):
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"{status}: {name}")
    if details:
        print(f"   {details}")
    return passed

def make_request(method, endpoint, token=None, params=None):
    url = f"{BASE_URL}{endpoint}"
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    
    time.sleep(0.3)
    
    try:
        if method == "GET":
            resp = requests.get(url, headers=headers, params=params, timeout=30)
        elif method == "POST":
            resp = requests.post(url, headers=headers, json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
        else:
            raise ValueError(f"Unsupported method: {method}")
        return resp
    except Exception as e:
        print(f"   ⚠️  Request error: {str(e)}")
        return None

print("=" * 80)
print("PHASE 4 FOCUSED BACKEND TESTS - APTIVA RL")
print("=" * 80)

# Step 1: Login as admin
print("\n1. Login as admin...")
resp = make_request("POST", "/auth/login")
if not resp or resp.status_code != 200:
    print("❌ FAILED: Could not login")
    exit(1)

token = resp.json()["token"]
print(f"✅ Logged in successfully")

# Step 2: Get mandante_id and empresa_id
print("\n2. Getting mandante and empresa IDs...")
resp = make_request("GET", "/mandantes", token=token)
if not resp or resp.status_code != 200:
    print("❌ FAILED: Could not get mandantes")
    exit(1)

mandantes = resp.json()["mandantes"]
if not mandantes:
    print("❌ FAILED: No mandantes found")
    exit(1)

mandante_id = mandantes[0]["mandante_id"]
print(f"✅ Got mandante_id: {mandante_id}")

resp = make_request("GET", "/empresas", token=token)
if not resp or resp.status_code != 200:
    print("❌ FAILED: Could not get empresas")
    exit(1)

empresas = resp.json()["empresas"]
if not empresas:
    print("❌ FAILED: No empresas found")
    exit(1)

empresa_id = empresas[0]["empresa_id"]
print(f"✅ Got empresa_id: {empresa_id}")

# Phase 4 Tests
results = []

print("\n" + "=" * 80)
print("PHASE 4 TESTS")
print("=" * 80)

# Test 1: Dashboard no filters with docs_por_estado
print("\n=== Test 1: GET /api/dashboard (no filters) ===")
resp = make_request("GET", "/dashboard", token=token)
if not resp:
    results.append(log_test("Dashboard (no filters)", False, "Request failed"))
elif resp.status_code != 200:
    results.append(log_test("Dashboard (no filters)", False, f"Status {resp.status_code}: {resp.text}"))
else:
    data = resp.json()
    
    # Check required fields
    if "stats" not in data or "acreditacion_por_mandante" not in data or "docs_por_estado" not in data:
        results.append(log_test("Dashboard (no filters)", False, f"Missing required fields. Keys: {data.keys()}"))
    else:
        stats = data["stats"]
        docs_por_estado = data["docs_por_estado"]
        
        # Verify stats has all required fields
        required_stats = ["mandantes", "contratos_vigentes", "trabajadores", "vehiculos", "equipos",
                         "docs_pendientes", "docs_por_vencer", "docs_vencidos", 
                         "trabajadores_acreditados", "trabajadores_bloqueados", "trabajadores_revision"]
        missing_stats = [f for f in required_stats if f not in stats]
        
        if missing_stats:
            results.append(log_test("Dashboard (no filters)", False, f"Missing stats fields: {missing_stats}"))
        elif not isinstance(docs_por_estado, list):
            results.append(log_test("Dashboard (no filters)", False, f"docs_por_estado should be array, got {type(docs_por_estado)}"))
        elif docs_por_estado and ("estado" not in docs_por_estado[0] or "c" not in docs_por_estado[0]):
            results.append(log_test("Dashboard (no filters)", False, f"docs_por_estado items should have 'estado' and 'c', got {docs_por_estado[0].keys()}"))
        else:
            results.append(log_test("Dashboard (no filters)", True, 
                f"mandantes={stats['mandantes']}, trabajadores={stats['trabajadores']}, docs_por_estado={len(docs_por_estado)} items"))
            print(f"   docs_por_estado sample: {docs_por_estado[0] if docs_por_estado else 'empty'}")

# Test 2: Dashboard with mandante_id filter
print("\n=== Test 2: GET /api/dashboard?mandante_id=X ===")
resp = make_request("GET", "/dashboard", token=token, params={"mandante_id": mandante_id})
if not resp:
    results.append(log_test("Dashboard (mandante filter)", False, "Request failed"))
elif resp.status_code != 200:
    results.append(log_test("Dashboard (mandante filter)", False, f"Status {resp.status_code}: {resp.text}"))
else:
    data = resp.json()
    stats = data.get("stats", {})
    
    # When filtering by mandante, mandantes should be 1
    if stats.get("mandantes") != 1:
        results.append(log_test("Dashboard (mandante filter)", False, f"Expected mandantes=1, got {stats.get('mandantes')}"))
    else:
        acreditacion = data.get("acreditacion_por_mandante", {})
        results.append(log_test("Dashboard (mandante filter)", True,
            f"mandantes={stats['mandantes']}, contratos={stats.get('contratos_vigentes')}, trabajadores={stats.get('trabajadores')}"))

# Test 3: Dashboard with empresa_id filter
print("\n=== Test 3: GET /api/dashboard?empresa_id=X ===")
resp = make_request("GET", "/dashboard", token=token, params={"empresa_id": empresa_id})
if not resp:
    results.append(log_test("Dashboard (empresa filter)", False, "Request failed"))
elif resp.status_code != 200:
    results.append(log_test("Dashboard (empresa filter)", False, f"Status {resp.status_code}: {resp.text}"))
else:
    data = resp.json()
    stats = data.get("stats", {})
    results.append(log_test("Dashboard (empresa filter)", True,
        f"contratos={stats.get('contratos_vigentes')}, trabajadores={stats.get('trabajadores')}, vehiculos={stats.get('vehiculos')}, equipos={stats.get('equipos')}"))

# Test 4: Dashboard with combined filters
print("\n=== Test 4: GET /api/dashboard?empresa_id=X&mandante_id=Y ===")
resp = make_request("GET", "/dashboard", token=token, params={"empresa_id": empresa_id, "mandante_id": mandante_id})
if not resp:
    results.append(log_test("Dashboard (combined filters)", False, "Request failed"))
elif resp.status_code != 200:
    results.append(log_test("Dashboard (combined filters)", False, f"Status {resp.status_code}: {resp.text}"))
else:
    data = resp.json()
    stats = data.get("stats", {})
    results.append(log_test("Dashboard (combined filters)", True,
        f"mandantes={stats.get('mandantes')}, contratos={stats.get('contratos_vigentes')}, trabajadores={stats.get('trabajadores')}"))

# Test 5: Notificaciones
print("\n=== Test 5: GET /api/notificaciones ===")
resp = make_request("GET", "/notificaciones", token=token)
if not resp:
    results.append(log_test("Notificaciones", False, "Request failed"))
elif resp.status_code != 200:
    results.append(log_test("Notificaciones", False, f"Status {resp.status_code}: {resp.text}"))
else:
    data = resp.json()
    required_fields = ["vencidos", "por_vencer", "pendientes_revision", "total"]
    missing = [f for f in required_fields if f not in data]
    
    if missing:
        results.append(log_test("Notificaciones", False, f"Missing fields: {missing}"))
    elif not isinstance(data["vencidos"], list) or not isinstance(data["por_vencer"], list):
        results.append(log_test("Notificaciones", False, "vencidos/por_vencer should be arrays"))
    elif not isinstance(data["pendientes_revision"], int) or not isinstance(data["total"], int):
        results.append(log_test("Notificaciones", False, "pendientes_revision/total should be integers"))
    else:
        # Check structure of items
        all_items = data["vencidos"] + data["por_vencer"]
        if all_items:
            first_item = all_items[0]
            required_item_fields = ["documento", "mandante", "dias_restantes", "fecha_vencimiento"]
            missing_item_fields = [f for f in required_item_fields if f not in first_item]
            
            if missing_item_fields:
                results.append(log_test("Notificaciones", False, f"Items missing fields: {missing_item_fields}"))
            else:
                # Verify vencidos have dias_restantes < 0
                vencidos_ok = all(item["dias_restantes"] < 0 for item in data["vencidos"])
                por_vencer_ok = all(item["dias_restantes"] >= 0 for item in data["por_vencer"])
                
                if not vencidos_ok:
                    results.append(log_test("Notificaciones", False, "vencidos should have dias_restantes < 0"))
                elif not por_vencer_ok:
                    results.append(log_test("Notificaciones", False, "por_vencer should have dias_restantes >= 0"))
                else:
                    results.append(log_test("Notificaciones", True,
                        f"vencidos={len(data['vencidos'])}, por_vencer={len(data['por_vencer'])}, pendientes={data['pendientes_revision']}, total={data['total']}"))
        else:
            results.append(log_test("Notificaciones", True,
                f"vencidos={len(data['vencidos'])}, por_vencer={len(data['por_vencer'])}, pendientes={data['pendientes_revision']}, total={data['total']}"))

# Test 6: Regression - Login all 4 roles
print("\n=== Test 6: Regression - Login all 4 roles ===")
users = [
    ("admin@aptivarl.com", "Aptiva2025!"),
    ("empresa@aptivarl.com", "Aptiva2025!"),
    ("revisor@aptivarl.com", "Aptiva2025!"),
    ("mandante@aptivarl.com", "Aptiva2025!")
]
all_login_ok = True
for email, password in users:
    resp = requests.post(f"{BASE_URL}/auth/login", json={"email": email, "password": password}, timeout=30)
    if not resp or resp.status_code != 200:
        print(f"   ❌ {email} login failed")
        all_login_ok = False
    else:
        print(f"   ✅ {email} login OK")

results.append(log_test("Regression - Login all roles", all_login_ok, ""))

# Test 7: Regression - GET /api/mandantes
print("\n=== Test 7: Regression - GET /api/mandantes ===")
resp = make_request("GET", "/mandantes", token=token)
if not resp or resp.status_code != 200:
    results.append(log_test("Regression - mandantes", False, "Request failed"))
else:
    mandantes = resp.json().get("mandantes", [])
    results.append(log_test("Regression - mandantes", True, f"Found {len(mandantes)} mandantes"))

# Test 8: Regression - GET /api/trabajadores
print("\n=== Test 8: Regression - GET /api/trabajadores ===")
resp = make_request("GET", "/trabajadores", token=token)
if not resp or resp.status_code != 200:
    results.append(log_test("Regression - trabajadores", False, "Request failed"))
else:
    trabajadores = resp.json().get("trabajadores", [])
    results.append(log_test("Regression - trabajadores", True, f"Found {len(trabajadores)} trabajadores"))

# Test 9: Regression - GET /api/vehiculos
print("\n=== Test 9: Regression - GET /api/vehiculos ===")
resp = make_request("GET", "/vehiculos", token=token)
if not resp or resp.status_code != 200:
    results.append(log_test("Regression - vehiculos", False, "Request failed"))
else:
    vehiculos = resp.json().get("vehiculos", [])
    results.append(log_test("Regression - vehiculos", True, f"Found {len(vehiculos)} vehiculos"))

# Summary
print("\n" + "=" * 80)
print("PHASE 4 TEST SUMMARY")
print("=" * 80)
passed = sum(1 for r in results if r)
total = len(results)
print(f"Passed: {passed}/{total}")
print(f"Failed: {total - passed}/{total}")

if passed == total:
    print("\n🎉 ALL PHASE 4 TESTS PASSED!")
    exit(0)
else:
    print(f"\n⚠️  {total - passed} TEST(S) FAILED")
    exit(1)
