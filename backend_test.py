#!/usr/bin/env python3
"""
Backend test for Usuarios CRUD endpoints
Tests the new Usuarios (users) CRUD endpoints of the Aptiva RL Next.js app
"""

import requests
import random
import string
import sys

# Base URL from .env
BASE_URL = "https://aptiva-db.preview.emergentagent.com/api"

# Admin credentials
ADMIN_EMAIL = "admin@aptivarl.com"
ADMIN_PASSWORD = "Aptiva2025!"

def generate_random_email():
    """Generate random email for test user"""
    random_str = ''.join(random.choices(string.ascii_lowercase + string.digits, k=8))
    return f"qatest_{random_str}@aptivarl.com"

def test_usuarios_crud():
    """Test Usuarios CRUD endpoints"""
    print("=" * 80)
    print("TESTING USUARIOS CRUD ENDPOINTS")
    print("=" * 80)
    
    token = None
    admin_perfil_id = None
    test_user_perfil_id = None
    test_email = generate_random_email()
    mandante_id_1 = None
    mandante_id_2 = None
    
    try:
        # ========================================================================
        # STEP 0: Login as admin to get token
        # ========================================================================
        print("\n[STEP 0] POST /api/auth/login - Login as admin")
        print("-" * 80)
        
        response = requests.post(
            f"{BASE_URL}/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
            timeout=30
        )
        
        print(f"Status: {response.status_code}")
        
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
        
        admin_perfil_id = profile.get("perfil_id")
        role_codigo = profile.get("role_codigo")
        
        print(f"✅ PASSED: Login successful")
        print(f"   Token: {token[:20]}...")
        print(f"   Admin perfil_id: {admin_perfil_id}")
        print(f"   Role: {role_codigo}")
        
        if role_codigo != "SUPER_ADMIN_HOLDING":
            print(f"❌ FAILED: Expected role SUPER_ADMIN_HOLDING, got {role_codigo}")
            return False
        
        headers = {"Authorization": f"Bearer {token}"}
        
        # ========================================================================
        # STEP 1: GET /api/usuarios - Verify structure
        # ========================================================================
        print("\n[STEP 1] GET /api/usuarios - Verify structure")
        print("-" * 80)
        
        response = requests.get(f"{BASE_URL}/usuarios", headers=headers, timeout=30)
        
        print(f"Status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ FAILED: Expected 200, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
        
        data = response.json()
        
        # Verify top-level keys
        if "usuarios" not in data:
            print("❌ FAILED: Missing 'usuarios' key in response")
            return False
        
        if "roles" not in data:
            print("❌ FAILED: Missing 'roles' key in response")
            return False
        
        if "mandantesAll" not in data:
            print("❌ FAILED: Missing 'mandantesAll' key in response")
            return False
        
        usuarios = data["usuarios"]
        roles = data["roles"]
        mandantesAll = data["mandantesAll"]
        
        print(f"✅ PASSED: Response has all required keys")
        print(f"   usuarios: {len(usuarios)} users")
        print(f"   roles: {len(roles)} roles")
        print(f"   mandantesAll: {len(mandantesAll)} mandantes")
        
        # Verify usuarios structure
        if len(usuarios) == 0:
            print("❌ FAILED: usuarios array is empty")
            return False
        
        sample_user = usuarios[0]
        required_user_fields = ["perfil_id", "email", "nombre", "role_codigo", "activo", "telefono", "mandantes"]
        
        for field in required_user_fields:
            if field not in sample_user:
                print(f"❌ FAILED: Missing field '{field}' in usuario object")
                return False
        
        print(f"✅ PASSED: Usuario object has all required fields")
        print(f"   Sample user: {sample_user.get('email')} - {sample_user.get('nombre')}")
        
        # Verify mandantes is an array
        if not isinstance(sample_user["mandantes"], list):
            print(f"❌ FAILED: mandantes should be an array, got {type(sample_user['mandantes'])}")
            return False
        
        print(f"✅ PASSED: mandantes is an array")
        
        # Verify roles structure
        required_roles = ["MANDANTE_ADMIN", "MANDANTE_VISOR", "MANDANTE_RRHH", "MANDANTE_PREVENCION"]
        role_codigos = [r.get("codigo") for r in roles]
        
        for req_role in required_roles:
            if req_role not in role_codigos:
                print(f"❌ FAILED: Missing required role '{req_role}' in roles array")
                return False
        
        print(f"✅ PASSED: All required roles present")
        print(f"   Roles: {', '.join(role_codigos)}")
        
        # Capture 2 mandante_id values for later
        if len(mandantesAll) < 2:
            print(f"❌ FAILED: Need at least 2 mandantes, got {len(mandantesAll)}")
            return False
        
        mandante_id_1 = mandantesAll[0]["mandante_id"]
        mandante_id_2 = mandantesAll[1]["mandante_id"]
        
        print(f"✅ PASSED: Captured 2 mandante IDs for testing")
        print(f"   Mandante 1: {mandantesAll[0]['razon_social']} ({mandante_id_1})")
        print(f"   Mandante 2: {mandantesAll[1]['razon_social']} ({mandante_id_2})")
        
        # ========================================================================
        # STEP 2: POST /api/usuarios - Create test user
        # ========================================================================
        print("\n[STEP 2] POST /api/usuarios - Create test user")
        print("-" * 80)
        
        new_user_data = {
            "email": test_email,
            "password": "Aptiva2025!",
            "nombre": "QA Test User",
            "telefono": "+56 9 1111 2222",
            "role_codigo": "MANDANTE_VISOR",
            "mandantes": [mandante_id_1, mandante_id_2]
        }
        
        print(f"Creating user: {test_email}")
        print(f"   Role: MANDANTE_VISOR")
        print(f"   Mandantes: 2 assigned")
        
        response = requests.post(
            f"{BASE_URL}/usuarios",
            headers=headers,
            json=new_user_data,
            timeout=30
        )
        
        print(f"Status: {response.status_code}")
        
        if response.status_code != 201:
            print(f"❌ FAILED: Expected 201, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
        
        data = response.json()
        
        if "perfil" not in data:
            print("❌ FAILED: Missing 'perfil' key in response")
            return False
        
        test_user_perfil_id = data["perfil"]["perfil_id"]
        
        print(f"✅ PASSED: User created successfully")
        print(f"   perfil_id: {test_user_perfil_id}")
        
        # Verify user appears in GET /api/usuarios
        print("\n   Verifying user appears in GET /api/usuarios...")
        
        response = requests.get(f"{BASE_URL}/usuarios", headers=headers, timeout=30)
        
        if response.status_code != 200:
            print(f"❌ FAILED: GET /api/usuarios returned {response.status_code}")
            return False
        
        data = response.json()
        usuarios = data["usuarios"]
        
        test_user = None
        for user in usuarios:
            if user["perfil_id"] == test_user_perfil_id:
                test_user = user
                break
        
        if not test_user:
            print(f"❌ FAILED: Test user not found in usuarios list")
            return False
        
        print(f"✅ PASSED: Test user found in usuarios list")
        
        # Verify telefono
        if test_user.get("telefono") != "+56 9 1111 2222":
            print(f"❌ FAILED: telefono mismatch. Expected '+56 9 1111 2222', got '{test_user.get('telefono')}'")
            return False
        
        print(f"✅ PASSED: telefono set correctly: {test_user.get('telefono')}")
        
        # Verify activo
        if test_user.get("activo") != True:
            print(f"❌ FAILED: activo should be true, got {test_user.get('activo')}")
            return False
        
        print(f"✅ PASSED: activo=true")
        
        # Verify mandantes
        user_mandantes = test_user.get("mandantes", [])
        
        if not isinstance(user_mandantes, list):
            print(f"❌ FAILED: mandantes should be an array, got {type(user_mandantes)}")
            return False
        
        if len(user_mandantes) != 2:
            print(f"❌ FAILED: Expected 2 mandantes, got {len(user_mandantes)}")
            return False
        
        user_mandante_ids = [m["mandante_id"] for m in user_mandantes]
        
        if mandante_id_1 not in user_mandante_ids or mandante_id_2 not in user_mandante_ids:
            print(f"❌ FAILED: Mandantes not assigned correctly")
            print(f"   Expected: {mandante_id_1}, {mandante_id_2}")
            print(f"   Got: {user_mandante_ids}")
            return False
        
        print(f"✅ PASSED: mandantes contains 2 assigned mandantes")
        print(f"   Mandante 1: {user_mandantes[0]['razon_social']}")
        print(f"   Mandante 2: {user_mandantes[1]['razon_social']}")
        
        # ========================================================================
        # STEP 3: PUT /api/usuarios/:id - Update test user
        # ========================================================================
        print("\n[STEP 3] PUT /api/usuarios/:id - Update test user")
        print("-" * 80)
        
        update_data = {
            "nombre": "QA Test User EDIT",
            "role_codigo": "MANDANTE_RRHH",
            "telefono": "+56 9 3333 4444",
            "activo": False,
            "mandantes": [mandante_id_1]  # Only one mandante now
        }
        
        print(f"Updating user: {test_user_perfil_id}")
        print(f"   nombre: QA Test User EDIT")
        print(f"   role_codigo: MANDANTE_RRHH")
        print(f"   telefono: +56 9 3333 4444")
        print(f"   activo: false")
        print(f"   mandantes: 1 (only mandante_id_1)")
        
        response = requests.put(
            f"{BASE_URL}/usuarios/{test_user_perfil_id}",
            headers=headers,
            json=update_data,
            timeout=30
        )
        
        print(f"Status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ FAILED: Expected 200, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
        
        data = response.json()
        
        if data.get("ok") != True:
            print(f"❌ FAILED: Expected {{ok:true}}, got {data}")
            return False
        
        print(f"✅ PASSED: Update returned {{ok:true}}")
        
        # Verify changes via GET /api/usuarios
        print("\n   Verifying changes via GET /api/usuarios...")
        
        response = requests.get(f"{BASE_URL}/usuarios", headers=headers, timeout=30)
        
        if response.status_code != 200:
            print(f"❌ FAILED: GET /api/usuarios returned {response.status_code}")
            return False
        
        data = response.json()
        usuarios = data["usuarios"]
        
        updated_user = None
        for user in usuarios:
            if user["perfil_id"] == test_user_perfil_id:
                updated_user = user
                break
        
        if not updated_user:
            print(f"❌ FAILED: Updated user not found in usuarios list")
            return False
        
        # Verify nombre
        if updated_user.get("nombre") != "QA Test User EDIT":
            print(f"❌ FAILED: nombre not updated. Expected 'QA Test User EDIT', got '{updated_user.get('nombre')}'")
            return False
        
        print(f"✅ PASSED: nombre updated: {updated_user.get('nombre')}")
        
        # Verify role_codigo
        if updated_user.get("role_codigo") != "MANDANTE_RRHH":
            print(f"❌ FAILED: role_codigo not updated. Expected 'MANDANTE_RRHH', got '{updated_user.get('role_codigo')}'")
            return False
        
        print(f"✅ PASSED: role_codigo updated: {updated_user.get('role_codigo')}")
        
        # Verify telefono
        if updated_user.get("telefono") != "+56 9 3333 4444":
            print(f"❌ FAILED: telefono not updated. Expected '+56 9 3333 4444', got '{updated_user.get('telefono')}'")
            return False
        
        print(f"✅ PASSED: telefono updated: {updated_user.get('telefono')}")
        
        # Verify activo
        if updated_user.get("activo") != False:
            print(f"❌ FAILED: activo not updated. Expected false, got {updated_user.get('activo')}")
            return False
        
        print(f"✅ PASSED: activo updated: false")
        
        # Verify mandantes (should only contain mandante_id_1 now)
        updated_mandantes = updated_user.get("mandantes", [])
        
        if len(updated_mandantes) != 1:
            print(f"❌ FAILED: Expected 1 mandante, got {len(updated_mandantes)}")
            return False
        
        if updated_mandantes[0]["mandante_id"] != mandante_id_1:
            print(f"❌ FAILED: Mandante not updated correctly")
            print(f"   Expected: {mandante_id_1}")
            print(f"   Got: {updated_mandantes[0]['mandante_id']}")
            return False
        
        print(f"✅ PASSED: mandantes updated - now contains ONLY mandante_id_1")
        print(f"   Mandante: {updated_mandantes[0]['razon_social']}")
        
        # ========================================================================
        # STEP 4: DELETE /api/usuarios/:id - Delete test user
        # ========================================================================
        print("\n[STEP 4] DELETE /api/usuarios/:id - Delete test user")
        print("-" * 80)
        
        print(f"Deleting user: {test_user_perfil_id}")
        
        response = requests.delete(
            f"{BASE_URL}/usuarios/{test_user_perfil_id}",
            headers=headers,
            timeout=30
        )
        
        print(f"Status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ FAILED: Expected 200, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
        
        data = response.json()
        
        if data.get("ok") != True:
            print(f"❌ FAILED: Expected {{ok:true}}, got {data}")
            return False
        
        print(f"✅ PASSED: Delete returned {{ok:true}}")
        
        # Verify user is gone from GET /api/usuarios
        print("\n   Verifying user is gone from GET /api/usuarios...")
        
        response = requests.get(f"{BASE_URL}/usuarios", headers=headers, timeout=30)
        
        if response.status_code != 200:
            print(f"❌ FAILED: GET /api/usuarios returned {response.status_code}")
            return False
        
        data = response.json()
        usuarios = data["usuarios"]
        
        deleted_user = None
        for user in usuarios:
            if user["perfil_id"] == test_user_perfil_id:
                deleted_user = user
                break
        
        if deleted_user:
            print(f"❌ FAILED: Deleted user still appears in usuarios list")
            return False
        
        print(f"✅ PASSED: Test user is GONE from usuarios list")
        
        # Mark test_user_perfil_id as None since it's deleted
        test_user_perfil_id = None
        
        # ========================================================================
        # STEP 5a: Negative check - GET /api/usuarios without Authorization
        # ========================================================================
        print("\n[STEP 5a] Negative check - GET /api/usuarios WITHOUT Authorization header")
        print("-" * 80)
        
        response = requests.get(f"{BASE_URL}/usuarios", timeout=30)
        
        print(f"Status: {response.status_code}")
        
        if response.status_code != 401:
            print(f"❌ FAILED: Expected 401, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
        
        print(f"✅ PASSED: Correctly returned 401 without Authorization header")
        
        # ========================================================================
        # STEP 5b: Negative check - DELETE own user
        # ========================================================================
        print("\n[STEP 5b] Negative check - DELETE /api/usuarios/:id (admin's own user)")
        print("-" * 80)
        
        print(f"Attempting to delete admin's own user: {admin_perfil_id}")
        
        response = requests.delete(
            f"{BASE_URL}/usuarios/{admin_perfil_id}",
            headers=headers,
            timeout=30
        )
        
        print(f"Status: {response.status_code}")
        
        if response.status_code != 400:
            print(f"❌ FAILED: Expected 400, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
        
        data = response.json()
        error_message = data.get("error", "")
        
        if "propio" not in error_message.lower():
            print(f"❌ FAILED: Expected error message about deleting own user")
            print(f"   Got: {error_message}")
            return False
        
        print(f"✅ PASSED: Correctly returned 400 with message about not deleting own user")
        print(f"   Error message: {error_message}")
        
        # ========================================================================
        # ALL TESTS PASSED
        # ========================================================================
        print("\n" + "=" * 80)
        print("✅ ALL TESTS PASSED (5/5 steps)")
        print("=" * 80)
        print("\nSummary:")
        print("  1. GET /api/usuarios - Structure verified ✅")
        print("  2. POST /api/usuarios - Test user created ✅")
        print("  3. PUT /api/usuarios/:id - Test user updated ✅")
        print("  4. DELETE /api/usuarios/:id - Test user deleted ✅")
        print("  5. Negative checks - 401 without auth, 400 on self-delete ✅")
        print("\nCleanup: Test user successfully deleted")
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
    finally:
        # Cleanup: Try to delete test user if it still exists
        if test_user_perfil_id and token:
            try:
                print(f"\n[CLEANUP] Attempting to delete test user {test_user_perfil_id}...")
                response = requests.delete(
                    f"{BASE_URL}/usuarios/{test_user_perfil_id}",
                    headers={"Authorization": f"Bearer {token}"},
                    timeout=30
                )
                if response.status_code == 200:
                    print(f"✅ Cleanup successful: Test user deleted")
                else:
                    print(f"⚠️ Cleanup warning: Could not delete test user (status {response.status_code})")
            except Exception as e:
                print(f"⚠️ Cleanup warning: {e}")

if __name__ == "__main__":
    success = test_usuarios_crud()
    sys.exit(0 if success else 1)
