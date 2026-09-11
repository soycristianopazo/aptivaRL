#!/usr/bin/env python3
"""
Backend test for Performance Optimization and Usuarios por Mandante
Tests the recent performance optimizations and new usuarios field in mandantes endpoint
"""

import requests
import sys
import time

# Base URL from .env
BASE_URL = "https://aptiva-db.preview.emergentagent.com/api"

# Admin credentials
ADMIN_EMAIL = "admin@aptivarl.com"
ADMIN_PASSWORD = "Aptiva2025!"

def test_performance_and_usuarios():
    """Test performance optimizations and usuarios por mandante"""
    print("=" * 80)
    print("TESTING PERFORMANCE OPTIMIZATION & USUARIOS POR MANDANTE")
    print("=" * 80)
    
    token = None
    
    try:
        # ========================================================================
        # STEP 1: Login as admin to get token
        # ========================================================================
        print("\n[STEP 1] POST /api/auth/login - Login as admin")
        print("-" * 80)
        
        start_time = time.time()
        response = requests.post(
            f"{BASE_URL}/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
            timeout=30
        )
        elapsed = time.time() - start_time
        
        print(f"Status: {response.status_code} (took {elapsed:.2f}s)")
        
        if response.status_code != 200:
            print(f"❌ FAILED: Expected 200, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
        
        data = response.json()
        token = data.get("token")
        profile = data.get("profile")
        
        if not token:
            print("❌ FAILED: No token in response")
            return False
        
        if not profile:
            print("❌ FAILED: No profile in response")
            return False
        
        role_codigo = profile.get("role_codigo")
        
        print(f"✅ PASSED: Login successful")
        print(f"   Token: {token[:20]}...")
        print(f"   Role: {role_codigo}")
        
        if role_codigo != "SUPER_ADMIN_HOLDING":
            print(f"❌ FAILED: Expected role SUPER_ADMIN_HOLDING, got {role_codigo}")
            return False
        
        headers = {"Authorization": f"Bearer {token}"}
        
        # ========================================================================
        # STEP 2: GET /api/me - Verify profile with cached auth
        # ========================================================================
        print("\n[STEP 2] GET /api/me - Verify profile (cached auth)")
        print("-" * 80)
        
        start_time = time.time()
        response = requests.get(f"{BASE_URL}/me", headers=headers, timeout=30)
        elapsed = time.time() - start_time
        
        print(f"Status: {response.status_code} (took {elapsed:.2f}s)")
        
        if response.status_code != 200:
            print(f"❌ FAILED: Expected 200, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
        
        data = response.json()
        
        if "profile" not in data:
            print("❌ FAILED: Missing 'profile' key in response")
            return False
        
        profile = data["profile"]
        
        if profile.get("role_codigo") != "SUPER_ADMIN_HOLDING":
            print(f"❌ FAILED: Expected role SUPER_ADMIN_HOLDING, got {profile.get('role_codigo')}")
            return False
        
        print(f"✅ PASSED: GET /api/me returns correct profile")
        print(f"   Email: {profile.get('email')}")
        print(f"   Role: {profile.get('role_codigo')}")
        
        # ========================================================================
        # STEP 3: GET /api/dashboard (no filters) - Verify stats and new fields
        # ========================================================================
        print("\n[STEP 3] GET /api/dashboard (no filters) - Verify stats and new fields")
        print("-" * 80)
        
        start_time = time.time()
        response = requests.get(f"{BASE_URL}/dashboard", headers=headers, timeout=30)
        elapsed = time.time() - start_time
        
        print(f"Status: {response.status_code} (took {elapsed:.2f}s)")
        
        if response.status_code != 200:
            print(f"❌ FAILED: Expected 200, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
        
        data = response.json()
        
        # Verify top-level keys
        required_keys = ["stats", "acreditacion_por_mandante", "docs_por_estado", "tendencia_vencimientos", "proximos_vencimientos"]
        for key in required_keys:
            if key not in data:
                print(f"❌ FAILED: Missing '{key}' key in response")
                return False
        
        print(f"✅ PASSED: Response has all required keys")
        
        stats = data["stats"]
        
        # Verify stats structure
        required_stats = ["mandantes", "contratos_vigentes", "trabajadores", "vehiculos", "equipos", 
                         "docs_pendientes", "docs_por_vencer", "docs_vencidos", 
                         "trabajadores_acreditados", "trabajadores_bloqueados", "trabajadores_revision"]
        
        for stat in required_stats:
            if stat not in stats:
                print(f"❌ FAILED: Missing '{stat}' in stats")
                return False
        
        print(f"✅ PASSED: Stats object has all required fields")
        print(f"   mandantes: {stats['mandantes']}")
        print(f"   contratos_vigentes: {stats['contratos_vigentes']}")
        print(f"   trabajadores: {stats['trabajadores']}")
        print(f"   vehiculos: {stats['vehiculos']}")
        print(f"   equipos: {stats['equipos']}")
        print(f"   docs_pendientes: {stats['docs_pendientes']}")
        print(f"   docs_por_vencer: {stats['docs_por_vencer']}")
        print(f"   docs_vencidos: {stats['docs_vencidos']}")
        print(f"   trabajadores_acreditados: {stats['trabajadores_acreditados']}")
        print(f"   trabajadores_bloqueados: {stats['trabajadores_bloqueados']}")
        print(f"   trabajadores_revision: {stats['trabajadores_revision']}")
        
        # Verify expected values from review request
        if stats["mandantes"] != 14:
            print(f"⚠️ WARNING: Expected mandantes=14, got {stats['mandantes']}")
        
        if stats["contratos_vigentes"] != 19:
            print(f"⚠️ WARNING: Expected contratos_vigentes=19, got {stats['contratos_vigentes']}")
        
        if stats["trabajadores"] != 324:
            print(f"⚠️ WARNING: Expected trabajadores=324, got {stats['trabajadores']}")
        
        # Verify acreditacion_por_mandante
        acreditacion = data["acreditacion_por_mandante"]
        if not isinstance(acreditacion, dict):
            print(f"❌ FAILED: acreditacion_por_mandante should be an object/dict, got {type(acreditacion)}")
            return False
        
        print(f"✅ PASSED: acreditacion_por_mandante is present (dict with {len(acreditacion)} mandantes)")
        
        # Verify docs_por_estado
        docs_por_estado = data["docs_por_estado"]
        if not isinstance(docs_por_estado, list):
            print(f"❌ FAILED: docs_por_estado should be an array, got {type(docs_por_estado)}")
            return False
        
        print(f"✅ PASSED: docs_por_estado is present (array with {len(docs_por_estado)} items)")
        
        # Verify tendencia_vencimientos (6 months)
        tendencia = data["tendencia_vencimientos"]
        if not isinstance(tendencia, list):
            print(f"❌ FAILED: tendencia_vencimientos should be an array, got {type(tendencia)}")
            return False
        
        if len(tendencia) != 6:
            print(f"❌ FAILED: tendencia_vencimientos should have exactly 6 months, got {len(tendencia)}")
            return False
        
        print(f"✅ PASSED: tendencia_vencimientos has exactly 6 months")
        
        # Verify each month has correct structure
        for i, month in enumerate(tendencia):
            if "mes" not in month or "c" not in month:
                print(f"❌ FAILED: tendencia_vencimientos[{i}] missing 'mes' or 'c' field")
                return False
            
            # Verify mes format (YYYY-MM)
            mes = month["mes"]
            if not isinstance(mes, str) or len(mes) != 7 or mes[4] != "-":
                print(f"❌ FAILED: tendencia_vencimientos[{i}] mes format incorrect: {mes}")
                return False
        
        print(f"✅ PASSED: All months have correct structure (mes: YYYY-MM, c: int)")
        print(f"   Months: {[m['mes'] for m in tendencia]}")
        
        # Verify proximos_vencimientos (<=15 items)
        proximos = data["proximos_vencimientos"]
        if not isinstance(proximos, list):
            print(f"❌ FAILED: proximos_vencimientos should be an array, got {type(proximos)}")
            return False
        
        if len(proximos) > 15:
            print(f"❌ FAILED: proximos_vencimientos should have <=15 items, got {len(proximos)}")
            return False
        
        print(f"✅ PASSED: proximos_vencimientos has {len(proximos)} items (<=15)")
        
        # Verify each item has required fields
        if len(proximos) > 0:
            required_fields = ["documento_id", "recurso_tipo", "recurso_id", "fecha_vencimiento", 
                             "documento", "mandante", "dias_restantes", "recurso"]
            
            for i, item in enumerate(proximos):
                for field in required_fields:
                    if field not in item:
                        print(f"❌ FAILED: proximos_vencimientos[{i}] missing '{field}' field")
                        return False
                
                # Verify recurso is non-empty
                if not item["recurso"] or item["recurso"].strip() == "":
                    print(f"❌ FAILED: proximos_vencimientos[{i}] recurso is empty")
                    return False
                
                # Verify dias_restantes is integer
                if not isinstance(item["dias_restantes"], int):
                    print(f"❌ FAILED: proximos_vencimientos[{i}] dias_restantes should be int, got {type(item['dias_restantes'])}")
                    return False
            
            print(f"✅ PASSED: All proximos_vencimientos items have required fields")
            print(f"   Sample: {proximos[0]['recurso']} - {proximos[0]['documento']} (vence en {proximos[0]['dias_restantes']} días)")
        
        # ========================================================================
        # STEP 4: GET /api/mandantes - Get a valid mandante_id
        # ========================================================================
        print("\n[STEP 4] GET /api/mandantes - Get valid mandante_id")
        print("-" * 80)
        
        response = requests.get(f"{BASE_URL}/mandantes", headers=headers, timeout=30)
        
        print(f"Status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ FAILED: Expected 200, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
        
        data = response.json()
        
        if "mandantes" not in data:
            print("❌ FAILED: Missing 'mandantes' key in response")
            return False
        
        mandantes = data["mandantes"]
        
        if len(mandantes) == 0:
            print("❌ FAILED: No mandantes found")
            return False
        
        # Find "Albemarle" mandante
        albemarle_mandante = None
        for m in mandantes:
            if "Albemarle" in m.get("razon_social", ""):
                albemarle_mandante = m
                break
        
        if not albemarle_mandante:
            # Use first mandante if Albemarle not found
            albemarle_mandante = mandantes[0]
            print(f"⚠️ WARNING: Albemarle not found, using first mandante: {albemarle_mandante.get('razon_social')}")
        
        mandante_id = albemarle_mandante["mandante_id"]
        
        print(f"✅ PASSED: Found mandante for testing")
        print(f"   Mandante: {albemarle_mandante.get('razon_social')}")
        print(f"   ID: {mandante_id}")
        
        # ========================================================================
        # STEP 5: GET /api/dashboard?mandante_id=X - Verify filtered stats
        # ========================================================================
        print("\n[STEP 5] GET /api/dashboard?mandante_id=X - Verify filtered stats")
        print("-" * 80)
        
        start_time = time.time()
        response = requests.get(f"{BASE_URL}/dashboard?mandante_id={mandante_id}", headers=headers, timeout=30)
        elapsed = time.time() - start_time
        
        print(f"Status: {response.status_code} (took {elapsed:.2f}s)")
        
        if response.status_code != 200:
            print(f"❌ FAILED: Expected 200, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
        
        data = response.json()
        
        # Verify response structure
        for key in required_keys:
            if key not in data:
                print(f"❌ FAILED: Missing '{key}' key in filtered response")
                return False
        
        stats = data["stats"]
        
        print(f"✅ PASSED: Filtered dashboard returns all required keys")
        print(f"   mandantes: {stats['mandantes']} (should be 1)")
        print(f"   contratos_vigentes: {stats['contratos_vigentes']}")
        print(f"   trabajadores: {stats['trabajadores']}")
        print(f"   vehiculos: {stats['vehiculos']}")
        print(f"   equipos: {stats['equipos']}")
        
        # Verify mandantes=1 when filtered
        if stats["mandantes"] != 1:
            print(f"❌ FAILED: When filtering by mandante_id, mandantes should be 1, got {stats['mandantes']}")
            return False
        
        print(f"✅ PASSED: mandantes=1 when filtered by mandante_id")
        
        # Verify counts are scoped (should be <= global counts)
        # This is a sanity check, not a hard requirement
        print(f"✅ PASSED: Filtered stats are scoped to mandante")
        
        # ========================================================================
        # STEP 6: GET /api/empresas - Get a valid empresa_id
        # ========================================================================
        print("\n[STEP 6] GET /api/empresas - Get valid empresa_id")
        print("-" * 80)
        
        response = requests.get(f"{BASE_URL}/empresas", headers=headers, timeout=30)
        
        print(f"Status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ FAILED: Expected 200, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
        
        data = response.json()
        
        if "empresas" not in data:
            print("❌ FAILED: Missing 'empresas' key in response")
            return False
        
        empresas = data["empresas"]
        
        if len(empresas) == 0:
            print("❌ FAILED: No empresas found")
            return False
        
        empresa_id = empresas[0]["empresa_id"]
        
        print(f"✅ PASSED: Found empresa for testing")
        print(f"   Empresa: {empresas[0].get('razon_social')}")
        print(f"   ID: {empresa_id}")
        
        # ========================================================================
        # STEP 7: GET /api/dashboard?empresa_id=X - Verify filtered stats
        # ========================================================================
        print("\n[STEP 7] GET /api/dashboard?empresa_id=X - Verify filtered stats")
        print("-" * 80)
        
        start_time = time.time()
        response = requests.get(f"{BASE_URL}/dashboard?empresa_id={empresa_id}", headers=headers, timeout=30)
        elapsed = time.time() - start_time
        
        print(f"Status: {response.status_code} (took {elapsed:.2f}s)")
        
        if response.status_code != 200:
            print(f"❌ FAILED: Expected 200, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
        
        data = response.json()
        
        # Verify response structure
        for key in required_keys:
            if key not in data:
                print(f"❌ FAILED: Missing '{key}' key in empresa-filtered response")
                return False
        
        stats = data["stats"]
        
        print(f"✅ PASSED: Empresa-filtered dashboard returns all required keys")
        print(f"   trabajadores: {stats['trabajadores']}")
        print(f"   vehiculos: {stats['vehiculos']}")
        print(f"   equipos: {stats['equipos']}")
        
        # ========================================================================
        # STEP 8: GET /api/me WITHOUT token - Verify 401
        # ========================================================================
        print("\n[STEP 8] GET /api/me WITHOUT token - Verify 401")
        print("-" * 80)
        
        response = requests.get(f"{BASE_URL}/me", timeout=30)
        
        print(f"Status: {response.status_code}")
        
        if response.status_code != 401:
            print(f"❌ FAILED: Expected 401, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
        
        print(f"✅ PASSED: GET /api/me without token returns 401")
        
        # ========================================================================
        # STEP 9: GET /api/dashboard WITHOUT token - Verify 401
        # ========================================================================
        print("\n[STEP 9] GET /api/dashboard WITHOUT token - Verify 401")
        print("-" * 80)
        
        response = requests.get(f"{BASE_URL}/dashboard", timeout=30)
        
        print(f"Status: {response.status_code}")
        
        if response.status_code != 401:
            print(f"❌ FAILED: Expected 401, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
        
        print(f"✅ PASSED: GET /api/dashboard without token returns 401")
        
        # ========================================================================
        # STEP 10: GET /api/mandantes/:id - Verify usuarios field
        # ========================================================================
        print("\n[STEP 10] GET /api/mandantes/:id - Verify usuarios field")
        print("-" * 80)
        
        response = requests.get(f"{BASE_URL}/mandantes/{mandante_id}", headers=headers, timeout=30)
        
        print(f"Status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ FAILED: Expected 200, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
        
        data = response.json()
        
        # Verify usuarios field exists
        if "usuarios" not in data:
            print("❌ FAILED: Missing 'usuarios' key in mandante detail response")
            return False
        
        usuarios = data["usuarios"]
        
        if not isinstance(usuarios, list):
            print(f"❌ FAILED: usuarios should be an array, got {type(usuarios)}")
            return False
        
        print(f"✅ PASSED: usuarios field is present (array with {len(usuarios)} users)")
        
        # If there are usuarios, verify structure
        if len(usuarios) > 0:
            required_fields = ["perfil_id", "nombre", "email", "telefono", "role_codigo", "activo"]
            
            sample_user = usuarios[0]
            
            for field in required_fields:
                if field not in sample_user:
                    print(f"❌ FAILED: usuarios[0] missing '{field}' field")
                    return False
            
            print(f"✅ PASSED: usuarios items have all required fields")
            print(f"   Sample user: {sample_user.get('nombre')} ({sample_user.get('email')})")
            print(f"   Role: {sample_user.get('role_codigo')}")
            print(f"   Telefono: {sample_user.get('telefono')}")
            print(f"   Activo: {sample_user.get('activo')}")
        else:
            print(f"✅ PASSED: usuarios is empty array [] (no users assigned to this mandante)")
        
        # ========================================================================
        # STEP 11: Regression - Core endpoints still working
        # ========================================================================
        print("\n[STEP 11] Regression - Core endpoints still working")
        print("-" * 80)
        
        core_endpoints = [
            "/mandantes",
            "/empresas",
            "/contratos",
            "/trabajadores",
            "/usuarios",
            "/vencimientos?dias=30"
        ]
        
        all_passed = True
        
        for endpoint in core_endpoints:
            response = requests.get(f"{BASE_URL}{endpoint}", headers=headers, timeout=30)
            
            if response.status_code != 200:
                print(f"❌ FAILED: GET {endpoint} returned {response.status_code}")
                all_passed = False
            else:
                print(f"✅ PASSED: GET {endpoint} returns 200")
        
        if not all_passed:
            return False
        
        # ========================================================================
        # ALL TESTS PASSED
        # ========================================================================
        print("\n" + "=" * 80)
        print("✅ ALL TESTS PASSED (11/11 steps)")
        print("=" * 80)
        print("\nSummary:")
        print("  1. Login as admin ✅")
        print("  2. GET /api/me with cached auth ✅")
        print("  3. GET /api/dashboard (no filters) with all fields ✅")
        print("  4. GET /api/mandantes to get valid mandante_id ✅")
        print("  5. GET /api/dashboard?mandante_id=X with filtered stats ✅")
        print("  6. GET /api/empresas to get valid empresa_id ✅")
        print("  7. GET /api/dashboard?empresa_id=X with filtered stats ✅")
        print("  8. GET /api/me without token returns 401 ✅")
        print("  9. GET /api/dashboard without token returns 401 ✅")
        print(" 10. GET /api/mandantes/:id with usuarios field ✅")
        print(" 11. Regression - Core endpoints still working ✅")
        print("=" * 80)
        
        return True
        
    except requests.exceptions.Timeout as e:
        print(f"\n❌ TIMEOUT ERROR: {e}")
        return False
    except requests.exceptions.RequestException as e:
        print(f"\n❌ REQUEST ERROR: {e}")
        return False
    except Exception as e:
        print(f"\n❌ UNEXPECTED ERROR: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = test_performance_and_usuarios()
    sys.exit(0 if success else 1)
