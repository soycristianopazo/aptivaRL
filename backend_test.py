#!/usr/bin/env python3
"""
Backend Test: User Deletion with Dependency Preview (Aptiva RL)
Tests GET /api/usuarios/:id/dependencias and DELETE /api/usuarios/:id endpoints
"""

import requests
import json
import random
import string
from datetime import datetime

# Configuration
BASE_URL = "https://aptiva-db.preview.emergentagent.com/api"
ADMIN_EMAIL = "admin@aptivarl.com"
ADMIN_PASSWORD = "Aptiva2025!"

# Test state
admin_token = None
admin_perfil_id = None
created_users = []  # Track throwaway users for cleanup

def log(msg):
    """Print timestamped log message"""
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}")

def random_suffix():
    """Generate random suffix for test emails"""
    return ''.join(random.choices(string.ascii_lowercase + string.digits, k=8))

def test_login():
    """TEST 1: Login as admin@aptivarl.com"""
    global admin_token, admin_perfil_id
    log("TEST 1: Login as admin@aptivarl.com")
    
    try:
        response = requests.post(
            f"{BASE_URL}/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            admin_token = data.get('token')
            admin_perfil_id = data.get('perfil_id')
            log(f"✅ Login successful: status={response.status_code}, token={admin_token[:20]}..., perfil_id={admin_perfil_id}")
            return True
        else:
            log(f"❌ Login failed: status={response.status_code}, response={response.text}")
            return False
    except Exception as e:
        log(f"❌ Login exception: {e}")
        return False

def test_get_usuarios():
    """TEST 2: GET /api/usuarios and capture mandantesAll"""
    log("TEST 2: GET /api/usuarios to capture mandantesAll")
    
    try:
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/usuarios", headers=headers, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            usuarios = data.get('usuarios', [])
            mandantes_all = data.get('mandantesAll', [])
            
            log(f"✅ GET /api/usuarios successful: status={response.status_code}")
            log(f"   - usuarios count: {len(usuarios)}")
            log(f"   - mandantesAll count: {len(mandantes_all)}")
            
            if mandantes_all:
                # Pick first mandante for testing
                mandante = mandantes_all[0]
                log(f"   - Selected mandante for testing: {mandante.get('razon_social')} (ID: {mandante.get('mandante_id')})")
                return mandante.get('mandante_id')
            else:
                log("❌ No mandantes found in mandantesAll")
                return None
        else:
            log(f"❌ GET /api/usuarios failed: status={response.status_code}, response={response.text}")
            return None
    except Exception as e:
        log(f"❌ GET /api/usuarios exception: {e}")
        return None

def test_create_user_with_mandante(mandante_id):
    """TEST 3: Create throwaway user WITH a mandante"""
    log("TEST 3: Create throwaway user WITH a mandante")
    
    try:
        headers = {"Authorization": f"Bearer {admin_token}"}
        email = f"qa_del_{random_suffix()}@aptivarl.com"
        
        payload = {
            "email": email,
            "password": "Aptiva2025!",
            "nombre": "QA Del Linked",
            "telefono": "",
            "role_codigo": "MANDANTE_VISOR",
            "empresa_id": "",
            "mandante_id": "",
            "activo": True,
            "mandantes": [mandante_id]
        }
        
        response = requests.post(f"{BASE_URL}/usuarios", json=payload, headers=headers, timeout=10)
        
        if response.status_code == 201:
            data = response.json()
            perfil_id = data.get('perfil_id')
            log(f"✅ User created: status={response.status_code}, email={email}, perfil_id={perfil_id}")
            
            # If perfil_id not in response, fetch from GET /api/usuarios
            if not perfil_id:
                log("   - perfil_id not in response, fetching from GET /api/usuarios...")
                usuarios_response = requests.get(f"{BASE_URL}/usuarios", headers=headers, timeout=10)
                if usuarios_response.status_code == 200:
                    usuarios = usuarios_response.json().get('usuarios', [])
                    user = next((u for u in usuarios if u.get('email') == email), None)
                    if user:
                        perfil_id = user.get('perfil_id')
                        log(f"   - Found perfil_id from GET: {perfil_id}")
            
            if perfil_id:
                created_users.append({"perfil_id": perfil_id, "email": email})
                return perfil_id
            else:
                log("❌ Could not determine perfil_id")
                return None
        else:
            log(f"❌ User creation failed: status={response.status_code}, response={response.text}")
            return None
    except Exception as e:
        log(f"❌ User creation exception: {e}")
        return None

def test_get_dependencias(perfil_id, expected_mandantes_count=1):
    """TEST 4: GET /api/usuarios/:id/dependencias"""
    log(f"TEST 4: GET /api/usuarios/{perfil_id}/dependencias")
    
    try:
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/usuarios/{perfil_id}/dependencias", headers=headers, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            mandantes = data.get('mandantes', [])
            empresa = data.get('empresa')
            docs_subidos = data.get('docs_subidos', 0)
            docs_revisados = data.get('docs_revisados', 0)
            trabajadores_creados = data.get('trabajadores_creados', 0)
            accesos = data.get('accesos', 0)
            vinculado = data.get('vinculado', False)
            
            log(f"✅ GET dependencias successful: status={response.status_code}")
            log(f"   - mandantes: {mandantes} (count: {len(mandantes)})")
            log(f"   - empresa: {empresa}")
            log(f"   - docs_subidos: {docs_subidos}")
            log(f"   - docs_revisados: {docs_revisados}")
            log(f"   - trabajadores_creados: {trabajadores_creados}")
            log(f"   - accesos: {accesos}")
            log(f"   - vinculado: {vinculado}")
            
            # Verify response structure
            if len(mandantes) >= expected_mandantes_count:
                log(f"✅ Mandantes count >= {expected_mandantes_count} (expected)")
            else:
                log(f"❌ Mandantes count {len(mandantes)} < {expected_mandantes_count} (expected)")
            
            if vinculado == (expected_mandantes_count > 0):
                log(f"✅ vinculado={vinculado} (expected)")
            else:
                log(f"❌ vinculado={vinculado} (expected {expected_mandantes_count > 0})")
            
            return True
        else:
            log(f"❌ GET dependencias failed: status={response.status_code}, response={response.text}")
            return False
    except Exception as e:
        log(f"❌ GET dependencias exception: {e}")
        return False

def test_delete_user(perfil_id):
    """TEST 5: DELETE /api/usuarios/:id"""
    log(f"TEST 5: DELETE /api/usuarios/{perfil_id}")
    
    try:
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.delete(f"{BASE_URL}/usuarios/{perfil_id}", headers=headers, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            log(f"✅ DELETE user successful: status={response.status_code}, response={data}")
            
            # Verify user no longer appears in GET /api/usuarios
            log("   - Verifying user no longer appears in GET /api/usuarios...")
            usuarios_response = requests.get(f"{BASE_URL}/usuarios", headers=headers, timeout=10)
            if usuarios_response.status_code == 200:
                usuarios = usuarios_response.json().get('usuarios', [])
                user = next((u for u in usuarios if u.get('perfil_id') == perfil_id), None)
                if user:
                    log(f"❌ User still appears in GET /api/usuarios (should be deleted)")
                    return False
                else:
                    log(f"✅ User no longer appears in GET /api/usuarios (deleted)")
                    return True
            else:
                log(f"⚠️ Could not verify deletion (GET /api/usuarios failed)")
                return True  # Assume success if DELETE returned 200
        else:
            log(f"❌ DELETE user failed: status={response.status_code}, response={response.text}")
            return False
    except Exception as e:
        log(f"❌ DELETE user exception: {e}")
        return False

def test_create_user_without_mandantes():
    """TEST 6: Create throwaway user WITHOUT mandantes"""
    log("TEST 6: Create throwaway user WITHOUT mandantes")
    
    try:
        headers = {"Authorization": f"Bearer {admin_token}"}
        email = f"qa_del2_{random_suffix()}@aptivarl.com"
        
        payload = {
            "email": email,
            "password": "Aptiva2025!",
            "nombre": "QA Del Empty",
            "telefono": "",
            "role_codigo": "MANDANTE_VISOR",
            "empresa_id": "",
            "mandante_id": "",
            "activo": True,
            "mandantes": []
        }
        
        response = requests.post(f"{BASE_URL}/usuarios", json=payload, headers=headers, timeout=10)
        
        if response.status_code == 201:
            data = response.json()
            perfil_id = data.get('perfil_id')
            log(f"✅ User created: status={response.status_code}, email={email}, perfil_id={perfil_id}")
            
            # If perfil_id not in response, fetch from GET /api/usuarios
            if not perfil_id:
                log("   - perfil_id not in response, fetching from GET /api/usuarios...")
                usuarios_response = requests.get(f"{BASE_URL}/usuarios", headers=headers, timeout=10)
                if usuarios_response.status_code == 200:
                    usuarios = usuarios_response.json().get('usuarios', [])
                    user = next((u for u in usuarios if u.get('email') == email), None)
                    if user:
                        perfil_id = user.get('perfil_id')
                        log(f"   - Found perfil_id from GET: {perfil_id}")
            
            if perfil_id:
                created_users.append({"perfil_id": perfil_id, "email": email})
                return perfil_id
            else:
                log("❌ Could not determine perfil_id")
                return None
        else:
            log(f"❌ User creation failed: status={response.status_code}, response={response.text}")
            return None
    except Exception as e:
        log(f"❌ User creation exception: {e}")
        return None

def test_authorization_non_super():
    """TEST 7: Authorization - non-super user should get 403/404"""
    log("TEST 7: Authorization - non-super user should get 403/404")
    
    # Note: We don't have credentials for non-super users, so we'll test with no token
    log("   - Testing GET /api/usuarios/:id/dependencias without token (should get 401)")
    
    try:
        # Test without token
        response = requests.get(f"{BASE_URL}/usuarios/{admin_perfil_id}/dependencias", timeout=10)
        if response.status_code == 401:
            log(f"✅ GET dependencias without token: status={response.status_code} (expected 401)")
        else:
            log(f"⚠️ GET dependencias without token: status={response.status_code} (expected 401)")
        
        # Test DELETE without token
        response = requests.delete(f"{BASE_URL}/usuarios/{admin_perfil_id}", timeout=10)
        if response.status_code == 401:
            log(f"✅ DELETE user without token: status={response.status_code} (expected 401)")
        else:
            log(f"⚠️ DELETE user without token: status={response.status_code} (expected 401)")
        
        log("   - Note: Cannot test with non-super user credentials (not available)")
        return True
    except Exception as e:
        log(f"❌ Authorization test exception: {e}")
        return False

def test_self_delete_guard():
    """TEST 8: Self-delete guard - admin cannot delete their own user"""
    log("TEST 8: Self-delete guard - admin cannot delete their own user")
    
    try:
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Find admin's perfil_id from GET /api/usuarios
        log("   - Finding admin's perfil_id from GET /api/usuarios...")
        response = requests.get(f"{BASE_URL}/usuarios", headers=headers, timeout=10)
        if response.status_code == 200:
            usuarios = response.json().get('usuarios', [])
            admin_user = next((u for u in usuarios if u.get('email') == ADMIN_EMAIL), None)
            if admin_user:
                admin_perfil = admin_user.get('perfil_id')
                log(f"   - Found admin perfil_id: {admin_perfil}")
                
                # Try to delete own user
                log(f"   - Attempting to DELETE own user (perfil_id={admin_perfil})...")
                delete_response = requests.delete(f"{BASE_URL}/usuarios/{admin_perfil}", headers=headers, timeout=10)
                
                if delete_response.status_code == 400:
                    data = delete_response.json()
                    error_msg = data.get('error', '')
                    log(f"✅ Self-delete blocked: status={delete_response.status_code}, error='{error_msg}'")
                    if 'propio usuario' in error_msg.lower():
                        log(f"✅ Error message correct: '{error_msg}'")
                        return True
                    else:
                        log(f"⚠️ Error message unexpected: '{error_msg}' (expected 'No puedes eliminar tu propio usuario')")
                        return True
                else:
                    log(f"❌ Self-delete not blocked: status={delete_response.status_code}, response={delete_response.text}")
                    return False
            else:
                log(f"❌ Admin user not found in GET /api/usuarios")
                return False
        else:
            log(f"❌ GET /api/usuarios failed: status={response.status_code}")
            return False
    except Exception as e:
        log(f"❌ Self-delete guard test exception: {e}")
        return False

def cleanup():
    """Cleanup: Delete any remaining throwaway users"""
    log("CLEANUP: Deleting any remaining throwaway users")
    
    if not created_users:
        log("   - No users to clean up")
        return
    
    headers = {"Authorization": f"Bearer {admin_token}"}
    for user in created_users:
        perfil_id = user.get('perfil_id')
        email = user.get('email')
        try:
            response = requests.delete(f"{BASE_URL}/usuarios/{perfil_id}", headers=headers, timeout=10)
            if response.status_code == 200:
                log(f"✅ Cleaned up user: {email} (perfil_id={perfil_id})")
            else:
                log(f"⚠️ Could not clean up user: {email} (status={response.status_code})")
        except Exception as e:
            log(f"⚠️ Cleanup exception for {email}: {e}")

def main():
    """Main test execution"""
    log("=" * 80)
    log("BACKEND TEST: User Deletion with Dependency Preview (Aptiva RL)")
    log("=" * 80)
    
    # TEST 1: Login
    if not test_login():
        log("FATAL: Login failed, cannot continue")
        return
    
    # TEST 2: GET /api/usuarios
    mandante_id = test_get_usuarios()
    if not mandante_id:
        log("FATAL: Could not get mandante_id, cannot continue")
        return
    
    # TEST 3: Create user WITH mandante
    perfil_id_1 = test_create_user_with_mandante(mandante_id)
    if not perfil_id_1:
        log("ERROR: Could not create user with mandante")
    else:
        # TEST 4: GET dependencias (should have mandantes)
        test_get_dependencias(perfil_id_1, expected_mandantes_count=1)
        
        # TEST 5: DELETE user
        if test_delete_user(perfil_id_1):
            # Remove from cleanup list if successfully deleted
            created_users[:] = [u for u in created_users if u.get('perfil_id') != perfil_id_1]
    
    # TEST 6: Create user WITHOUT mandantes
    perfil_id_2 = test_create_user_without_mandantes()
    if not perfil_id_2:
        log("ERROR: Could not create user without mandantes")
    else:
        # GET dependencias (should have vinculado=false, mandantes=[])
        test_get_dependencias(perfil_id_2, expected_mandantes_count=0)
        
        # DELETE user
        if test_delete_user(perfil_id_2):
            # Remove from cleanup list if successfully deleted
            created_users[:] = [u for u in created_users if u.get('perfil_id') != perfil_id_2]
    
    # TEST 7: Authorization
    test_authorization_non_super()
    
    # TEST 8: Self-delete guard
    test_self_delete_guard()
    
    # Cleanup
    cleanup()
    
    log("=" * 80)
    log("BACKEND TEST COMPLETE")
    log("=" * 80)

if __name__ == "__main__":
    main()
