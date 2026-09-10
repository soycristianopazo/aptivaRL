#!/usr/bin/env python3
"""
PHASE 7 Backend Testing: Worker assignment to multiple contracts
Tests the new multi-contract assignment rule (worker can be in multiple contracts, even same mandante)
"""

import requests
import json
import sys

BASE_URL = "https://aptiva-db.preview.emergentagent.com/api"
ADMIN_EMAIL = "admin@aptivarl.com"
ADMIN_PASSWORD = "Aptiva2025!"

def log(msg):
    print(f"[TEST] {msg}")

def test_phase7():
    """Test PHASE 7: Worker assignment to multiple contracts"""
    
    log("=" * 80)
    log("PHASE 7: Worker assignment to multiple contracts (multi-contract rule)")
    log("=" * 80)
    
    # Step 1: Login as admin
    log("\n1. Login as admin...")
    try:
        resp = requests.post(f"{BASE_URL}/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        }, timeout=30)
        if resp.status_code != 200:
            log(f"❌ Login failed: {resp.status_code} - {resp.text}")
            return False
        data = resp.json()
        token = data.get("token")
        if not token:
            log(f"❌ No token in response: {data}")
            return False
        log(f"✅ Login successful, token received")
        headers = {"Authorization": f"Bearer {token}"}
    except Exception as e:
        log(f"❌ Login exception: {e}")
        return False
    
    # Step 2: Get all contratos and find TWO with same empresa_id (and ideally same mandante)
    log("\n2. Finding two contratos with same empresa_id and same mandante...")
    try:
        resp = requests.get(f"{BASE_URL}/contratos", headers=headers, timeout=30)
        if resp.status_code != 200:
            log(f"❌ GET /contratos failed: {resp.status_code} - {resp.text}")
            return False
        contratos = resp.json().get("contratos", [])
        log(f"✅ Found {len(contratos)} contratos total")
        
        # Group by empresa_id and mandante_id
        by_empresa_mandante = {}
        for c in contratos:
            key = (c.get("empresa_id"), c.get("mandante_id"))
            if key not in by_empresa_mandante:
                by_empresa_mandante[key] = []
            by_empresa_mandante[key].append(c)
        
        # Find a pair with at least 2 contratos
        contrato_a = None
        contrato_b = None
        empresa_id = None
        mandante_id = None
        
        for (eid, mid), contracts in by_empresa_mandante.items():
            if len(contracts) >= 2:
                contrato_a = contracts[0]
                contrato_b = contracts[1]
                empresa_id = eid
                mandante_id = mid
                break
        
        if not contrato_a or not contrato_b:
            log(f"❌ Could not find two contratos with same empresa_id and mandante_id")
            log(f"   Trying to find two contratos with just same empresa_id...")
            # Fallback: find two contratos with same empresa_id (different mandante is OK)
            by_empresa = {}
            for c in contratos:
                eid = c.get("empresa_id")
                if eid not in by_empresa:
                    by_empresa[eid] = []
                by_empresa[eid].append(c)
            
            for eid, contracts in by_empresa.items():
                if len(contracts) >= 2:
                    contrato_a = contracts[0]
                    contrato_b = contracts[1]
                    empresa_id = eid
                    mandante_id = contrato_a.get("mandante_id")
                    break
        
        if not contrato_a or not contrato_b:
            log(f"❌ Could not find two contratos with same empresa_id")
            return False
        
        log(f"✅ Found contrato A: {contrato_a.get('numero_oc')} (empresa: {contrato_a.get('empresa')}, mandante: {contrato_a.get('mandante')})")
        log(f"✅ Found contrato B: {contrato_b.get('numero_oc')} (empresa: {contrato_b.get('empresa')}, mandante: {contrato_b.get('mandante')})")
        log(f"   empresa_id: {empresa_id}")
        log(f"   Contrato A mandante_id: {contrato_a.get('mandante_id')}")
        log(f"   Contrato B mandante_id: {contrato_b.get('mandante_id')}")
        if contrato_a.get('mandante_id') == contrato_b.get('mandante_id'):
            log(f"   ✅ Both contratos belong to SAME mandante (ideal for testing)")
        else:
            log(f"   ⚠️  Contratos belong to DIFFERENT mandantes (still valid test)")
        
    except Exception as e:
        log(f"❌ Exception finding contratos: {e}")
        return False
    
    # Step 3: Create a test worker with that empresa_id
    log("\n3. Creating test worker with empresa_id...")
    trabajador_id = None
    try:
        resp = requests.post(f"{BASE_URL}/trabajadores", headers=headers, json={
            "empresa_id": empresa_id,
            "rut": "ZZ-99999999-9",
            "nombre": "QA",
            "apellido": "Multi",
            "cargo": "Test Worker"
        }, timeout=30)
        if resp.status_code != 201:
            log(f"❌ POST /trabajadores failed: {resp.status_code} - {resp.text}")
            return False
        trabajador = resp.json().get("trabajador", {})
        trabajador_id = trabajador.get("trabajador_id")
        if not trabajador_id:
            log(f"❌ No trabajador_id in response: {resp.json()}")
            return False
        log(f"✅ Worker created: {trabajador.get('nombre')} {trabajador.get('apellido')} (RUT: {trabajador.get('rut')}, ID: {trabajador_id})")
    except Exception as e:
        log(f"❌ Exception creating worker: {e}")
        return False
    
    # Step 4: Assign worker to contrato A
    log("\n4. Assigning worker to contrato A...")
    try:
        resp = requests.post(f"{BASE_URL}/trabajadores/asignar", headers=headers, json={
            "trabajador_id": trabajador_id,
            "contrato_id": contrato_a.get("contrato_id")
        }, timeout=30)
        if resp.status_code != 201:
            log(f"❌ POST /trabajadores/asignar (contrato A) failed: {resp.status_code} - {resp.text}")
            return False
        log(f"✅ Worker assigned to contrato A ({contrato_a.get('numero_oc')}) - status 201")
    except Exception as e:
        log(f"❌ Exception assigning to contrato A: {e}")
        return False
    
    # Step 5: Assign SAME worker to contrato B (KEY TEST - should now return 201, not 409)
    log("\n5. Assigning SAME worker to contrato B (different contract, testing multi-contract rule)...")
    try:
        resp = requests.post(f"{BASE_URL}/trabajadores/asignar", headers=headers, json={
            "trabajador_id": trabajador_id,
            "contrato_id": contrato_b.get("contrato_id")
        }, timeout=30)
        if resp.status_code != 201:
            log(f"❌ POST /trabajadores/asignar (contrato B) failed: {resp.status_code} - {resp.text}")
            log(f"   EXPECTED: 201 (worker can be in multiple contracts)")
            log(f"   ACTUAL: {resp.status_code}")
            if resp.status_code == 409:
                log(f"   ⚠️  BUG: Still returning 409 for same-mandante assignment!")
                log(f"   The unique index change may not have been applied correctly.")
            return False
        log(f"✅ Worker assigned to contrato B ({contrato_b.get('numero_oc')}) - status 201")
        log(f"   ✅ MULTI-CONTRACT RULE WORKING: Worker can be in multiple contracts!")
    except Exception as e:
        log(f"❌ Exception assigning to contrato B: {e}")
        return False
    
    # Step 6: Try duplicate assignment to same contract (should return 409)
    log("\n6. Testing duplicate assignment to same contract (should return 409)...")
    try:
        resp = requests.post(f"{BASE_URL}/trabajadores/asignar", headers=headers, json={
            "trabajador_id": trabajador_id,
            "contrato_id": contrato_a.get("contrato_id")
        }, timeout=30)
        if resp.status_code != 409:
            log(f"❌ Expected 409 for duplicate contract assignment, got {resp.status_code}")
            log(f"   Response: {resp.text}")
            return False
        error_msg = resp.json().get("error", "")
        if "ya está asignado a este contrato" not in error_msg.lower():
            log(f"⚠️  Got 409 but unexpected error message: {error_msg}")
        log(f"✅ Duplicate assignment correctly rejected with 409: {error_msg}")
    except Exception as e:
        log(f"❌ Exception testing duplicate assignment: {e}")
        return False
    
    # Step 7: Try assignment to wrong empresa (should return 400)
    log("\n7. Testing assignment to wrong empresa (should return 400)...")
    try:
        # Find a contrato with different empresa_id
        wrong_contrato = None
        for c in contratos:
            if c.get("empresa_id") != empresa_id:
                wrong_contrato = c
                break
        
        if not wrong_contrato:
            log(f"⚠️  Could not find contrato with different empresa_id, skipping test")
        else:
            resp = requests.post(f"{BASE_URL}/trabajadores/asignar", headers=headers, json={
                "trabajador_id": trabajador_id,
                "contrato_id": wrong_contrato.get("contrato_id")
            }, timeout=30)
            if resp.status_code != 400:
                log(f"❌ Expected 400 for wrong empresa assignment, got {resp.status_code}")
                log(f"   Response: {resp.text}")
                return False
            error_msg = resp.json().get("error", "")
            if "solo puede asignarse a contratos de su empresa" not in error_msg.lower():
                log(f"⚠️  Got 400 but unexpected error message: {error_msg}")
            log(f"✅ Wrong empresa assignment correctly rejected with 400: {error_msg}")
    except Exception as e:
        log(f"❌ Exception testing wrong empresa: {e}")
        return False
    
    # Step 8: Verify GET endpoints show worker in both contracts
    log("\n8. Verifying GET endpoints show worker in both contracts...")
    try:
        # GET /contratos/:A should show worker
        resp = requests.get(f"{BASE_URL}/contratos/{contrato_a.get('contrato_id')}", headers=headers, timeout=30)
        if resp.status_code != 200:
            log(f"❌ GET /contratos/:A failed: {resp.status_code}")
            return False
        data = resp.json()
        trabajadores_a = data.get("trabajadores", [])
        worker_in_a = any(t.get("trabajador_id") == trabajador_id for t in trabajadores_a)
        if not worker_in_a:
            log(f"❌ Worker not found in contrato A trabajadores list")
            return False
        log(f"✅ GET /contratos/{contrato_a.get('numero_oc')} shows worker in trabajadores list")
        
        # GET /contratos/:B should show worker
        resp = requests.get(f"{BASE_URL}/contratos/{contrato_b.get('contrato_id')}", headers=headers, timeout=30)
        if resp.status_code != 200:
            log(f"❌ GET /contratos/:B failed: {resp.status_code}")
            return False
        data = resp.json()
        trabajadores_b = data.get("trabajadores", [])
        worker_in_b = any(t.get("trabajador_id") == trabajador_id for t in trabajadores_b)
        if not worker_in_b:
            log(f"❌ Worker not found in contrato B trabajadores list")
            return False
        log(f"✅ GET /contratos/{contrato_b.get('numero_oc')} shows worker in trabajadores list")
        
        # GET /trabajadores/:id should show both assignments
        resp = requests.get(f"{BASE_URL}/trabajadores/{trabajador_id}", headers=headers, timeout=30)
        if resp.status_code != 200:
            log(f"❌ GET /trabajadores/:id failed: {resp.status_code}")
            return False
        data = resp.json()
        asignaciones = data.get("asignaciones", [])
        if len(asignaciones) < 2:
            log(f"❌ Expected at least 2 assignments, got {len(asignaciones)}")
            return False
        log(f"✅ GET /trabajadores/:id shows {len(asignaciones)} assignments (both contracts)")
        
    except Exception as e:
        log(f"❌ Exception verifying GET endpoints: {e}")
        return False
    
    # Step 9: Regression tests
    log("\n9. Running regression tests...")
    try:
        # Health check
        resp = requests.get(f"{BASE_URL}/health", timeout=30)
        if resp.status_code != 200:
            log(f"❌ GET /health failed: {resp.status_code}")
            return False
        log(f"✅ GET /health returns 200")
        
        # Login all 4 roles
        roles = [
            ("admin@aptivarl.com", "Aptiva2025!", "SUPER_ADMIN_HOLDING"),
            ("empresa@aptivarl.com", "Aptiva2025!", "ADMIN_EMPRESA"),
            ("revisor@aptivarl.com", "Aptiva2025!", "REVISOR"),
            ("mandante@aptivarl.com", "Aptiva2025!", "USUARIO_MANDANTE")
        ]
        for email, password, expected_role in roles:
            resp = requests.post(f"{BASE_URL}/auth/login", json={"email": email, "password": password}, timeout=30)
            if resp.status_code != 200:
                log(f"❌ Login failed for {email}: {resp.status_code}")
                return False
            profile = resp.json().get("profile", {})
            if profile.get("role_codigo") != expected_role:
                log(f"❌ Wrong role for {email}: expected {expected_role}, got {profile.get('role_codigo')}")
                return False
        log(f"✅ Login all 4 roles OK with correct role_codigo")
        
        # GET /mandantes count
        resp = requests.get(f"{BASE_URL}/mandantes", headers=headers, timeout=30)
        if resp.status_code != 200:
            log(f"❌ GET /mandantes failed: {resp.status_code}")
            return False
        mandantes_count = len(resp.json().get("mandantes", []))
        log(f"✅ GET /mandantes returns {mandantes_count} mandantes (should be unchanged)")
        
        # GET /contratos count
        resp = requests.get(f"{BASE_URL}/contratos", headers=headers, timeout=30)
        if resp.status_code != 200:
            log(f"❌ GET /contratos failed: {resp.status_code}")
            return False
        contratos_count = len(resp.json().get("contratos", []))
        log(f"✅ GET /contratos returns {contratos_count} contratos (should be unchanged)")
        
    except Exception as e:
        log(f"❌ Exception in regression tests: {e}")
        return False
    
    # Step 10: Cleanup - delete test worker
    log("\n10. Cleanup: Deleting test worker...")
    try:
        resp = requests.delete(f"{BASE_URL}/trabajadores/{trabajador_id}", headers=headers, timeout=30)
        if resp.status_code != 200:
            log(f"❌ DELETE /trabajadores/:id failed: {resp.status_code} - {resp.text}")
            return False
        log(f"✅ Test worker deleted successfully")
    except Exception as e:
        log(f"❌ Exception deleting worker: {e}")
        return False
    
    log("\n" + "=" * 80)
    log("✅ PHASE 7 TESTING COMPLETE - ALL TESTS PASSED")
    log("=" * 80)
    return True

if __name__ == "__main__":
    try:
        success = test_phase7()
        sys.exit(0 if success else 1)
    except Exception as e:
        log(f"❌ FATAL ERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
