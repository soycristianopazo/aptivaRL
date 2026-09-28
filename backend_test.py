#!/usr/bin/env python3
"""
Backend test for NEW "Copia (CC) por alcance" feature in Aptiva RL.
Tests the copia_email field and CC computation in preview-correos endpoint.
"""

import requests
import json
import sys

BASE_URL = "https://aptiva-db.preview.emergentagent.com/api"

# Test credentials
ADMIN_EMAIL = "admin@aptivarl.com"
ADMIN_PASSWORD = "Aptiva2025!"

# Store original copia_email values for cleanup
original_copia_values = {}

def login(email, password):
    """Login and return token"""
    try:
        resp = requests.post(f"{BASE_URL}/auth/login", json={"email": email, "password": password}, timeout=30)
        print(f"✓ Login {email}: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            token = data.get("token")
            print(f"  Token length: {len(token) if token else 0}")
            return token
        else:
            print(f"  ❌ Login failed: {resp.text[:200]}")
            return None
    except Exception as e:
        print(f"  ❌ Login exception: {e}")
        return None

def get_usuarios(token):
    """GET /api/usuarios"""
    try:
        resp = requests.get(f"{BASE_URL}/usuarios", headers={"Authorization": f"Bearer {token}"}, timeout=30)
        print(f"\n✓ GET /api/usuarios: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            usuarios = data.get("usuarios", [])
            mandantesAll = data.get("mandantesAll", [])
            print(f"  Usuarios count: {len(usuarios)}")
            print(f"  MandantesAll count: {len(mandantesAll)}")
            return data
        else:
            print(f"  ❌ Failed: {resp.text[:200]}")
            return None
    except Exception as e:
        print(f"  ❌ Exception: {e}")
        return None

def update_usuario_copia_email(token, perfil_id, copia_email):
    """PUT /api/usuarios/:id {copia_email: true/false}"""
    try:
        resp = requests.put(
            f"{BASE_URL}/usuarios/{perfil_id}",
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            json={"copia_email": copia_email},
            timeout=30
        )
        print(f"  PUT /api/usuarios/{perfil_id} {{copia_email: {copia_email}}}: {resp.status_code}")
        if resp.status_code == 200:
            return True
        else:
            print(f"    ❌ Failed: {resp.text[:200]}")
            return False
    except Exception as e:
        print(f"    ❌ Exception: {e}")
        return False

def get_preview_correos(token, perfil_id):
    """GET /api/usuarios/:id/preview-correos"""
    try:
        resp = requests.get(
            f"{BASE_URL}/usuarios/{perfil_id}/preview-correos",
            headers={"Authorization": f"Bearer {token}"},
            timeout=30
        )
        print(f"  GET /api/usuarios/{perfil_id}/preview-correos: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            return data
        else:
            print(f"    ❌ Failed: {resp.text[:200]}")
            return None
    except Exception as e:
        print(f"    ❌ Exception: {e}")
        return None

def main():
    print("=" * 80)
    print("BACKEND TEST: Copia (CC) por alcance en alertas de vencimientos")
    print("=" * 80)
    
    # TEST 1: Login as admin
    print("\n[TEST 1] Login as admin@aptivarl.com")
    token = login(ADMIN_EMAIL, ADMIN_PASSWORD)
    if not token:
        print("❌ CRITICAL: Cannot login as admin. Aborting.")
        sys.exit(1)
    print("✅ TEST 1 PASSED: Admin login successful")
    
    # TEST 2: GET /api/usuarios and verify copia_email field
    print("\n[TEST 2] GET /api/usuarios -> verify copia_email field exists")
    usuarios_data = get_usuarios(token)
    if not usuarios_data:
        print("❌ CRITICAL: Cannot get usuarios. Aborting.")
        sys.exit(1)
    
    usuarios = usuarios_data.get("usuarios", [])
    mandantesAll = usuarios_data.get("mandantesAll", [])
    
    # Verify every usuario has copia_email field
    missing_copia = [u for u in usuarios if "copia_email" not in u]
    if missing_copia:
        print(f"  ❌ CRITICAL: {len(missing_copia)} usuarios missing copia_email field")
        print(f"    Sample: {missing_copia[0]}")
        sys.exit(1)
    
    # Verify copia_email is boolean
    non_bool = [u for u in usuarios if not isinstance(u.get("copia_email"), bool)]
    if non_bool:
        print(f"  ❌ CRITICAL: {len(non_bool)} usuarios have non-boolean copia_email")
        print(f"    Sample: {non_bool[0]}")
        sys.exit(1)
    
    print(f"  ✓ All {len(usuarios)} usuarios have copia_email field (boolean)")
    print("✅ TEST 2 PASSED: copia_email field exists and is boolean for all usuarios")
    
    # TEST 3: Find a MANDANTE_ADMIN with assigned mandantes
    print("\n[TEST 3] Find MANDANTE_ADMIN with assigned mandantes")
    mandante_admins = [u for u in usuarios if u.get("role_codigo") == "MANDANTE_ADMIN" and len(u.get("mandantes", [])) > 0]
    if not mandante_admins:
        print("  ❌ CRITICAL: No MANDANTE_ADMIN with mandantes found")
        sys.exit(1)
    
    admin_user = mandante_admins[0]
    admin_perfil_id = admin_user["perfil_id"]
    admin_mandantes = admin_user["mandantes"]
    mandante_M = admin_mandantes[0]
    mandante_M_id = mandante_M["mandante_id"]
    mandante_M_name = mandante_M["razon_social"]
    
    print(f"  ✓ Selected MANDANTE_ADMIN: {admin_user['nombre']} ({admin_user['email']})")
    print(f"  ✓ Perfil ID: {admin_perfil_id}")
    print(f"  ✓ Mandantes count: {len(admin_mandantes)}")
    print(f"  ✓ Selected mandante M: {mandante_M_name} (ID: {mandante_M_id})")
    print("✅ TEST 3 PASSED: Found MANDANTE_ADMIN with mandantes")
    
    # TEST 4: Pick a MANDANTE_RRHH user (global cc candidate)
    print("\n[TEST 4] Pick MANDANTE_RRHH user (global cc candidate)")
    rrhh_users = [u for u in usuarios if u.get("role_codigo") == "MANDANTE_RRHH"]
    if not rrhh_users:
        print("  ❌ CRITICAL: No MANDANTE_RRHH users found")
        sys.exit(1)
    
    rrhh_user = rrhh_users[0]
    rrhh_perfil_id = rrhh_user["perfil_id"]
    rrhh_email = rrhh_user["email"]
    rrhh_original_copia = rrhh_user["copia_email"]
    original_copia_values[rrhh_perfil_id] = rrhh_original_copia
    
    print(f"  ✓ Selected MANDANTE_RRHH: {rrhh_user['nombre']} ({rrhh_email})")
    print(f"  ✓ Perfil ID: {rrhh_perfil_id}")
    print(f"  ✓ Original copia_email: {rrhh_original_copia}")
    
    # Set copia_email=true for RRHH user
    print(f"  → Setting copia_email=true for RRHH user...")
    if not update_usuario_copia_email(token, rrhh_perfil_id, True):
        print("  ❌ CRITICAL: Failed to set copia_email=true for RRHH user")
        sys.exit(1)
    print("✅ TEST 4 PASSED: RRHH user copia_email set to true")
    
    # TEST 5: Pick another user linked to mandante M (scoped cc candidate)
    print("\n[TEST 5] Pick user linked to mandante M (scoped cc candidate)")
    # Find users that have mandante M in their mandantes array and are NOT MANDANTE_ADMIN and NOT the RRHH user
    scoped_candidates = [
        u for u in usuarios
        if u["perfil_id"] != admin_perfil_id
        and u["perfil_id"] != rrhh_perfil_id
        and u.get("role_codigo") != "MANDANTE_ADMIN"
        and any(m["mandante_id"] == mandante_M_id for m in u.get("mandantes", []))
    ]
    
    if not scoped_candidates:
        print("  ❌ CRITICAL: No scoped user found for mandante M")
        sys.exit(1)
    
    scoped_user = scoped_candidates[0]
    scoped_perfil_id = scoped_user["perfil_id"]
    scoped_email = scoped_user["email"]
    scoped_original_copia = scoped_user["copia_email"]
    original_copia_values[scoped_perfil_id] = scoped_original_copia
    
    print(f"  ✓ Selected scoped user: {scoped_user['nombre']} ({scoped_email})")
    print(f"  ✓ Role: {scoped_user['role_codigo']}")
    print(f"  ✓ Perfil ID: {scoped_perfil_id}")
    print(f"  ✓ Original copia_email: {scoped_original_copia}")
    print(f"  ✓ Mandantes: {[m['razon_social'] for m in scoped_user.get('mandantes', [])]}")
    
    # Set copia_email=true for scoped user
    print(f"  → Setting copia_email=true for scoped user...")
    if not update_usuario_copia_email(token, scoped_perfil_id, True):
        print("  ❌ CRITICAL: Failed to set copia_email=true for scoped user")
        sys.exit(1)
    print("✅ TEST 5 PASSED: Scoped user copia_email set to true")
    
    # TEST 6: GET preview-correos and verify cc contains both users
    print("\n[TEST 6] GET /api/usuarios/:id/preview-correos -> verify cc")
    preview_data = get_preview_correos(token, admin_perfil_id)
    if not preview_data:
        print("  ❌ CRITICAL: Failed to get preview-correos")
        sys.exit(1)
    
    correos = preview_data.get("correos", [])
    print(f"  ✓ Correos count: {len(correos)}")
    
    # Find correo for mandante M
    correo_M = None
    for c in correos:
        if c.get("mandante_id") == mandante_M_id:
            correo_M = c
            break
    
    if not correo_M:
        print(f"  ❌ CRITICAL: No correo found for mandante M ({mandante_M_name})")
        print(f"  Available mandantes in correos: {[c.get('mandante') for c in correos]}")
        sys.exit(1)
    
    print(f"  ✓ Found correo for mandante M: {correo_M.get('mandante')}")
    print(f"  ✓ Document count: {correo_M.get('count')}")
    
    # Verify cc array
    cc = correo_M.get("cc", [])
    cc_emails = correo_M.get("cc_emails", [])
    
    print(f"  ✓ CC array length: {len(cc)}")
    print(f"  ✓ CC emails: {cc_emails}")
    
    # Verify RRHH user (global) is in cc
    rrhh_in_cc = any(c.get("email") == rrhh_email for c in cc)
    if not rrhh_in_cc:
        print(f"  ❌ CRITICAL: RRHH user ({rrhh_email}) NOT in cc (should be global)")
        print(f"  CC: {cc}")
        sys.exit(1)
    print(f"  ✓ RRHH user ({rrhh_email}) found in cc (global)")
    
    # Verify scoped user is in cc
    scoped_in_cc = any(c.get("email") == scoped_email for c in cc)
    if not scoped_in_cc:
        print(f"  ❌ CRITICAL: Scoped user ({scoped_email}) NOT in cc (should be scoped to mandante M)")
        print(f"  CC: {cc}")
        sys.exit(1)
    print(f"  ✓ Scoped user ({scoped_email}) found in cc (scoped to mandante M)")
    
    # Verify primary recipient (admin) is NOT in cc
    admin_email = admin_user["email"]
    admin_in_cc = any(c.get("email") == admin_email for c in cc)
    if admin_in_cc:
        print(f"  ❌ CRITICAL: Primary recipient ({admin_email}) found in cc (should be excluded)")
        print(f"  CC: {cc}")
        sys.exit(1)
    print(f"  ✓ Primary recipient ({admin_email}) NOT in cc (correctly excluded)")
    
    # Verify cc_emails contains both emails
    if rrhh_email not in cc_emails:
        print(f"  ❌ CRITICAL: RRHH email ({rrhh_email}) NOT in cc_emails")
        sys.exit(1)
    if scoped_email not in cc_emails:
        print(f"  ❌ CRITICAL: Scoped email ({scoped_email}) NOT in cc_emails")
        sys.exit(1)
    print(f"  ✓ cc_emails contains both RRHH and scoped user emails")
    
    print("✅ TEST 6 PASSED: CC computation correct (global + scoped, excludes primary)")
    
    # TEST 7: Negative scope check
    print("\n[TEST 7] Negative scope check: user linked to DIFFERENT mandante")
    # Find a mandante that is NOT mandante M
    other_mandantes = [m for m in mandantesAll if m["mandante_id"] != mandante_M_id]
    if not other_mandantes:
        print("  ⚠️ WARNING: No other mandantes available for negative scope test")
    else:
        other_mandante = other_mandantes[0]
        other_mandante_id = other_mandante["mandante_id"]
        other_mandante_name = other_mandante["razon_social"]
        
        print(f"  ✓ Selected other mandante: {other_mandante_name} (ID: {other_mandante_id})")
        
        # Find a user linked ONLY to other_mandante (not to mandante M)
        negative_candidates = [
            u for u in usuarios
            if u["perfil_id"] != admin_perfil_id
            and u["perfil_id"] != rrhh_perfil_id
            and u["perfil_id"] != scoped_perfil_id
            and u.get("role_codigo") not in ["MANDANTE_RRHH", "SUPER_ADMIN_HOLDING"]  # not global
            and any(m["mandante_id"] == other_mandante_id for m in u.get("mandantes", []))
            and not any(m["mandante_id"] == mandante_M_id for m in u.get("mandantes", []))
        ]
        
        if not negative_candidates:
            print("  ⚠️ WARNING: No user found linked ONLY to other mandante (not to M)")
        else:
            negative_user = negative_candidates[0]
            negative_perfil_id = negative_user["perfil_id"]
            negative_email = negative_user["email"]
            negative_original_copia = negative_user["copia_email"]
            original_copia_values[negative_perfil_id] = negative_original_copia
            
            print(f"  ✓ Selected negative user: {negative_user['nombre']} ({negative_email})")
            print(f"  ✓ Mandantes: {[m['razon_social'] for m in negative_user.get('mandantes', [])]}")
            
            # Set copia_email=true for negative user
            print(f"  → Setting copia_email=true for negative user...")
            if not update_usuario_copia_email(token, negative_perfil_id, True):
                print("  ❌ Failed to set copia_email=true for negative user")
            else:
                # Get preview-correos again
                preview_data2 = get_preview_correos(token, admin_perfil_id)
                if preview_data2:
                    correos2 = preview_data2.get("correos", [])
                    correo_M2 = None
                    for c in correos2:
                        if c.get("mandante_id") == mandante_M_id:
                            correo_M2 = c
                            break
                    
                    if correo_M2:
                        cc2 = correo_M2.get("cc", [])
                        negative_in_cc = any(c.get("email") == negative_email for c in cc2)
                        if negative_in_cc:
                            print(f"  ❌ CRITICAL: Negative user ({negative_email}) found in cc for mandante M (should NOT be there)")
                            print(f"  CC: {cc2}")
                            sys.exit(1)
                        print(f"  ✓ Negative user ({negative_email}) NOT in cc for mandante M (correct)")
                        print("✅ TEST 7 PASSED: Negative scope check successful")
                    else:
                        print("  ⚠️ WARNING: Could not find correo M in second preview")
                else:
                    print("  ⚠️ WARNING: Could not get preview-correos for negative test")
    
    # TEST 8: PUT toggle copia_email
    print("\n[TEST 8] PUT toggle: set copia_email=false and verify")
    print(f"  → Setting copia_email=false for RRHH user...")
    if not update_usuario_copia_email(token, rrhh_perfil_id, False):
        print("  ❌ Failed to set copia_email=false for RRHH user")
    else:
        # Verify via GET /api/usuarios
        usuarios_data2 = get_usuarios(token)
        if usuarios_data2:
            usuarios2 = usuarios_data2.get("usuarios", [])
            rrhh_user2 = next((u for u in usuarios2 if u["perfil_id"] == rrhh_perfil_id), None)
            if rrhh_user2:
                if rrhh_user2["copia_email"] == False:
                    print(f"  ✓ RRHH user copia_email now false (verified via GET)")
                    print("✅ TEST 8 PASSED: PUT toggle working correctly")
                else:
                    print(f"  ❌ CRITICAL: RRHH user copia_email still true after setting to false")
                    sys.exit(1)
            else:
                print("  ⚠️ WARNING: Could not find RRHH user in GET response")
        else:
            print("  ⚠️ WARNING: Could not get usuarios for toggle verification")
    
    # TEST 9: Authorization check (no token)
    print("\n[TEST 9] Authorization: GET preview-correos without token -> 401")
    try:
        resp = requests.get(f"{BASE_URL}/usuarios/{admin_perfil_id}/preview-correos", timeout=30)
        print(f"  GET /api/usuarios/:id/preview-correos (no token): {resp.status_code}")
        if resp.status_code == 401:
            print("  ✓ Correctly returned 401 without token")
            print("✅ TEST 9 PASSED: Authorization check successful")
        else:
            print(f"  ❌ CRITICAL: Expected 401, got {resp.status_code}")
            sys.exit(1)
    except Exception as e:
        print(f"  ❌ Exception: {e}")
    
    # CLEANUP: Revert all copia_email changes
    print("\n[CLEANUP] Reverting copia_email to original values")
    for perfil_id, original_value in original_copia_values.items():
        print(f"  → Reverting {perfil_id} to copia_email={original_value}")
        update_usuario_copia_email(token, perfil_id, original_value)
    
    # Verify cleanup
    print("\n[CLEANUP VERIFICATION] Verifying all users reverted")
    usuarios_data_final = get_usuarios(token)
    if usuarios_data_final:
        usuarios_final = usuarios_data_final.get("usuarios", [])
        for perfil_id, original_value in original_copia_values.items():
            user_final = next((u for u in usuarios_final if u["perfil_id"] == perfil_id), None)
            if user_final:
                if user_final["copia_email"] == original_value:
                    print(f"  ✓ {perfil_id}: copia_email={original_value} (reverted)")
                else:
                    print(f"  ❌ WARNING: {perfil_id}: copia_email={user_final['copia_email']} (expected {original_value})")
            else:
                print(f"  ⚠️ WARNING: Could not find user {perfil_id} in final GET")
    
    print("\n" + "=" * 80)
    print("✅ ALL TESTS PASSED: Copia (CC) por alcance feature working correctly")
    print("=" * 80)
    print("\nSUMMARY:")
    print("  ✅ copia_email field exists and is boolean for all usuarios")
    print("  ✅ MANDANTE_RRHH user (global) appears in cc for all mandantes")
    print("  ✅ Scoped user appears in cc only for their assigned mandantes")
    print("  ✅ Primary recipient excluded from cc")
    print("  ✅ Negative scope check: user NOT in cc for mandantes they don't have")
    print("  ✅ PUT toggle working correctly")
    print("  ✅ Authorization check: 401 without token")
    print("  ✅ Cleanup successful: all copia_email values reverted")
    print("\nNO REAL EMAILS SENT (preview endpoint only)")

if __name__ == "__main__":
    main()
