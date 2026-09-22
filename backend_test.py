#!/usr/bin/env python3
"""
Backend API Testing for Aptiva RL - Punto de acceso por URL (slug)
Tests the NEW slug functionality for puntos_acceso
"""
import requests
import json
import sys

# Backend URL from .env
BASE_URL = "https://aptiva-db.preview.emergentagent.com/api"

# Test credentials
ADMIN_EMAIL = "admin@aptivarl.com"
ADMIN_PASSWORD = "Aptiva2025!"
MANDANTE_EMAIL = "dugarte@rioloa.cl"
MANDANTE_PASSWORD = "Aptiva2025!"

# Global variables to store test data
admin_token = None
mandante_token = None
punto1_id = None
punto1_slug = None
punto2_id = None
punto2_slug = None

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
            return data.get("token")
        else:
            print(f"❌ Login failed for {email}: {response.status_code} - {response.text}")
            return None
    except Exception as e:
        print(f"❌ Login exception for {email}: {str(e)}")
        return None

def test_1_post_punto_with_slug():
    """Test 1: POST /api/puntos-acceso with nombre 'Portería Principal Mejillones' → 201 with slug 'porteria-principal-mejillones'"""
    global punto1_id, punto1_slug
    print("\n=== TEST 1: POST /api/puntos-acceso (crear punto con slug) ===")
    
    try:
        response = requests.post(
            f"{BASE_URL}/puntos-acceso",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"nombre": "Portería Principal Mejillones"},
            timeout=10
        )
        
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 201:
            data = response.json()
            if data.get("ok") and data.get("id") and data.get("slug"):
                punto1_id = data["id"]
                punto1_slug = data["slug"]
                
                # Verify slug is exactly "porteria-principal-mejillones"
                if punto1_slug == "porteria-principal-mejillones":
                    print(f"✅ TEST 1 PASSED: Created punto with id={punto1_id}, slug={punto1_slug}")
                    return True
                else:
                    print(f"❌ TEST 1 FAILED: Expected slug 'porteria-principal-mejillones', got '{punto1_slug}'")
                    return False
            else:
                print(f"❌ TEST 1 FAILED: Response missing required fields (ok, id, slug)")
                return False
        else:
            print(f"❌ TEST 1 FAILED: Expected 201, got {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ TEST 1 EXCEPTION: {str(e)}")
        return False

def test_2_post_duplicate_nombre():
    """Test 2: POST another punto with SAME nombre → 201 with unique slug ending in '-2'"""
    global punto2_id, punto2_slug
    print("\n=== TEST 2: POST /api/puntos-acceso (mismo nombre, slug único con -2) ===")
    
    try:
        response = requests.post(
            f"{BASE_URL}/puntos-acceso",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"nombre": "Portería Principal Mejillones"},
            timeout=10
        )
        
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 201:
            data = response.json()
            if data.get("ok") and data.get("id") and data.get("slug"):
                punto2_id = data["id"]
                punto2_slug = data["slug"]
                
                # Verify slug ends with "-2"
                if punto2_slug == "porteria-principal-mejillones-2":
                    print(f"✅ TEST 2 PASSED: Created punto with id={punto2_id}, slug={punto2_slug} (unique with -2)")
                    return True
                else:
                    print(f"❌ TEST 2 FAILED: Expected slug 'porteria-principal-mejillones-2', got '{punto2_slug}'")
                    return False
            else:
                print(f"❌ TEST 2 FAILED: Response missing required fields")
                return False
        else:
            print(f"❌ TEST 2 FAILED: Expected 201, got {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ TEST 2 EXCEPTION: {str(e)}")
        return False

def test_3_get_public_punto_by_slug():
    """Test 3: GET /api/public/punto?slug=<slug> WITHOUT token → 200 with punto data"""
    print("\n=== TEST 3: GET /api/public/punto?slug (público, sin token) ===")
    
    try:
        response = requests.get(
            f"{BASE_URL}/public/punto?slug={punto1_slug}",
            timeout=10
        )
        
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            data = response.json()
            punto = data.get("punto")
            if punto and punto.get("id") == punto1_id and punto.get("slug") == punto1_slug:
                # Verify all required fields
                required_fields = ["id", "nombre", "ubicacion", "activo", "slug"]
                missing = [f for f in required_fields if f not in punto]
                if not missing:
                    print(f"✅ TEST 3 PASSED: Public endpoint returned punto with all required fields")
                    print(f"   Punto: id={punto['id']}, nombre={punto['nombre']}, slug={punto['slug']}, activo={punto['activo']}")
                    return True
                else:
                    print(f"❌ TEST 3 FAILED: Missing fields: {missing}")
                    return False
            else:
                print(f"❌ TEST 3 FAILED: Punto data mismatch or missing")
                return False
        else:
            print(f"❌ TEST 3 FAILED: Expected 200, got {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ TEST 3 EXCEPTION: {str(e)}")
        return False

def test_4_get_public_punto_not_found():
    """Test 4: GET /api/public/punto?slug=no-existe-xyz → 404"""
    print("\n=== TEST 4: GET /api/public/punto?slug=no-existe-xyz (404) ===")
    
    try:
        response = requests.get(
            f"{BASE_URL}/public/punto?slug=no-existe-xyz",
            timeout=10
        )
        
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 404:
            print(f"✅ TEST 4 PASSED: Non-existent slug correctly returns 404")
            return True
        else:
            print(f"❌ TEST 4 FAILED: Expected 404, got {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ TEST 4 EXCEPTION: {str(e)}")
        return False

def test_5_get_public_punto_no_slug():
    """Test 5: GET /api/public/punto WITHOUT slug parameter → 400"""
    print("\n=== TEST 5: GET /api/public/punto sin parámetro slug (400) ===")
    
    try:
        response = requests.get(
            f"{BASE_URL}/public/punto",
            timeout=10
        )
        
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 400:
            print(f"✅ TEST 5 PASSED: Missing slug parameter correctly returns 400")
            return True
        else:
            print(f"❌ TEST 5 FAILED: Expected 400, got {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ TEST 5 EXCEPTION: {str(e)}")
        return False

def test_6_put_punto_inactive_then_get_403():
    """Test 6: PUT /api/puntos-acceso/:id with activo:false → 200; then GET /api/public/punto?slug → 403"""
    print("\n=== TEST 6: PUT punto activo=false, luego GET público → 403 ===")
    
    try:
        # First, deactivate the punto
        response = requests.put(
            f"{BASE_URL}/puntos-acceso/{punto1_id}",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"activo": False},
            timeout=10
        )
        
        print(f"PUT Status: {response.status_code}")
        print(f"PUT Response: {response.text}")
        
        if response.status_code != 200:
            print(f"❌ TEST 6 FAILED: PUT failed with {response.status_code}")
            return False
        
        # Now try to GET the inactive punto via public endpoint
        response = requests.get(
            f"{BASE_URL}/public/punto?slug={punto1_slug}",
            timeout=10
        )
        
        print(f"GET Status: {response.status_code}")
        print(f"GET Response: {response.text}")
        
        if response.status_code == 403:
            print(f"✅ TEST 6 PASSED: Inactive punto correctly returns 403 on public endpoint")
            return True
        else:
            print(f"❌ TEST 6 FAILED: Expected 403 for inactive punto, got {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ TEST 6 EXCEPTION: {str(e)}")
        return False

def test_7_get_public_puntos_includes_slug():
    """Test 7: GET /api/public/puntos → 200 and each element includes 'slug' field"""
    print("\n=== TEST 7: GET /api/public/puntos (verificar campo slug) ===")
    
    try:
        response = requests.get(
            f"{BASE_URL}/public/puntos",
            timeout=10
        )
        
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            puntos = data.get("puntos", [])
            print(f"Found {len(puntos)} active puntos")
            
            if len(puntos) == 0:
                print(f"⚠️  TEST 7 WARNING: No active puntos found (punto1 was deactivated in test 6)")
                # Check if punto2 is in the list
                punto2_found = any(p.get("slug") == punto2_slug for p in puntos)
                if not punto2_found:
                    print(f"❌ TEST 7 FAILED: punto2 (slug={punto2_slug}) should be active but not found")
                    return False
            
            # Verify all puntos have slug field
            missing_slug = [p for p in puntos if "slug" not in p]
            if missing_slug:
                print(f"❌ TEST 7 FAILED: {len(missing_slug)} puntos missing 'slug' field")
                return False
            
            # Verify punto2 is in the list (it should be active)
            punto2_found = any(p.get("slug") == punto2_slug for p in puntos)
            if punto2_found:
                print(f"✅ TEST 7 PASSED: All active puntos include 'slug' field. punto2 (slug={punto2_slug}) is present.")
                return True
            else:
                print(f"❌ TEST 7 FAILED: punto2 (slug={punto2_slug}) not found in active puntos")
                return False
        else:
            print(f"❌ TEST 7 FAILED: Expected 200, got {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ TEST 7 EXCEPTION: {str(e)}")
        return False

def test_8_security_no_token():
    """Test 8a: POST/PUT/DELETE /api/puntos-acceso WITHOUT token → 401"""
    print("\n=== TEST 8a: Seguridad - POST/PUT/DELETE sin token → 401 ===")
    
    all_passed = True
    
    # Test POST without token
    try:
        response = requests.post(
            f"{BASE_URL}/puntos-acceso",
            json={"nombre": "Test"},
            timeout=10
        )
        print(f"POST without token: {response.status_code}")
        if response.status_code == 401:
            print(f"✅ POST without token correctly returns 401")
        else:
            print(f"❌ POST without token: Expected 401, got {response.status_code}")
            all_passed = False
    except Exception as e:
        print(f"❌ POST without token exception: {str(e)}")
        all_passed = False
    
    # Test PUT without token
    try:
        response = requests.put(
            f"{BASE_URL}/puntos-acceso/{punto1_id}",
            json={"activo": True},
            timeout=10
        )
        print(f"PUT without token: {response.status_code}")
        if response.status_code == 401:
            print(f"✅ PUT without token correctly returns 401")
        else:
            print(f"❌ PUT without token: Expected 401, got {response.status_code}")
            all_passed = False
    except Exception as e:
        print(f"❌ PUT without token exception: {str(e)}")
        all_passed = False
    
    # Test DELETE without token
    try:
        response = requests.delete(
            f"{BASE_URL}/puntos-acceso/{punto1_id}",
            timeout=10
        )
        print(f"DELETE without token: {response.status_code}")
        if response.status_code == 401:
            print(f"✅ DELETE without token correctly returns 401")
        else:
            print(f"❌ DELETE without token: Expected 401, got {response.status_code}")
            all_passed = False
    except Exception as e:
        print(f"❌ DELETE without token exception: {str(e)}")
        all_passed = False
    
    if all_passed:
        print(f"✅ TEST 8a PASSED: All endpoints correctly return 401 without token")
    else:
        print(f"❌ TEST 8a FAILED: Some endpoints did not return 401")
    
    return all_passed

def test_8b_security_mandante_user():
    """Test 8b: POST/PUT/DELETE /api/puntos-acceso as mandante user → 403"""
    print("\n=== TEST 8b: Seguridad - POST/PUT/DELETE como usuario mandante → 403 ===")
    
    all_passed = True
    
    # Test POST as mandante
    try:
        response = requests.post(
            f"{BASE_URL}/puntos-acceso",
            headers={"Authorization": f"Bearer {mandante_token}"},
            json={"nombre": "Test"},
            timeout=10
        )
        print(f"POST as mandante: {response.status_code}")
        if response.status_code == 403:
            print(f"✅ POST as mandante correctly returns 403")
        else:
            print(f"❌ POST as mandante: Expected 403, got {response.status_code}")
            all_passed = False
    except Exception as e:
        print(f"❌ POST as mandante exception: {str(e)}")
        all_passed = False
    
    # Test PUT as mandante
    try:
        response = requests.put(
            f"{BASE_URL}/puntos-acceso/{punto1_id}",
            headers={"Authorization": f"Bearer {mandante_token}"},
            json={"activo": True},
            timeout=10
        )
        print(f"PUT as mandante: {response.status_code}")
        if response.status_code == 403:
            print(f"✅ PUT as mandante correctly returns 403")
        else:
            print(f"❌ PUT as mandante: Expected 403, got {response.status_code}")
            all_passed = False
    except Exception as e:
        print(f"❌ PUT as mandante exception: {str(e)}")
        all_passed = False
    
    # Test DELETE as mandante
    try:
        response = requests.delete(
            f"{BASE_URL}/puntos-acceso/{punto1_id}",
            headers={"Authorization": f"Bearer {mandante_token}"},
            timeout=10
        )
        print(f"DELETE as mandante: {response.status_code}")
        if response.status_code == 403:
            print(f"✅ DELETE as mandante correctly returns 403")
        else:
            print(f"❌ DELETE as mandante: Expected 403, got {response.status_code}")
            all_passed = False
    except Exception as e:
        print(f"❌ DELETE as mandante exception: {str(e)}")
        all_passed = False
    
    if all_passed:
        print(f"✅ TEST 8b PASSED: All endpoints correctly return 403 for mandante user")
    else:
        print(f"❌ TEST 8b FAILED: Some endpoints did not return 403")
    
    return all_passed

def test_9_cleanup():
    """Test 9: DELETE both test puntos created"""
    print("\n=== TEST 9: CLEANUP - DELETE puntos de prueba ===")
    
    all_passed = True
    
    # Delete punto1
    try:
        response = requests.delete(
            f"{BASE_URL}/puntos-acceso/{punto1_id}",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=10
        )
        print(f"DELETE punto1 ({punto1_slug}): {response.status_code}")
        if response.status_code == 200:
            print(f"✅ punto1 deleted successfully")
        else:
            print(f"❌ Failed to delete punto1: {response.status_code}")
            all_passed = False
    except Exception as e:
        print(f"❌ DELETE punto1 exception: {str(e)}")
        all_passed = False
    
    # Delete punto2
    try:
        response = requests.delete(
            f"{BASE_URL}/puntos-acceso/{punto2_id}",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=10
        )
        print(f"DELETE punto2 ({punto2_slug}): {response.status_code}")
        if response.status_code == 200:
            print(f"✅ punto2 deleted successfully")
        else:
            print(f"❌ Failed to delete punto2: {response.status_code}")
            all_passed = False
    except Exception as e:
        print(f"❌ DELETE punto2 exception: {str(e)}")
        all_passed = False
    
    # Verify they're gone
    try:
        response = requests.get(
            f"{BASE_URL}/public/puntos",
            timeout=10
        )
        if response.status_code == 200:
            data = response.json()
            puntos = data.get("puntos", [])
            punto1_still_exists = any(p.get("slug") == punto1_slug for p in puntos)
            punto2_still_exists = any(p.get("slug") == punto2_slug for p in puntos)
            
            if punto1_still_exists or punto2_still_exists:
                print(f"❌ Test puntos still appear in public list")
                all_passed = False
            else:
                print(f"✅ Verified: Test puntos no longer appear in public list")
    except Exception as e:
        print(f"⚠️  Could not verify cleanup: {str(e)}")
    
    if all_passed:
        print(f"✅ TEST 9 PASSED: Cleanup successful")
    else:
        print(f"❌ TEST 9 FAILED: Cleanup incomplete")
    
    return all_passed

def main():
    global admin_token, mandante_token
    
    print("=" * 80)
    print("BACKEND API TESTING - Punto de acceso por URL (slug)")
    print("=" * 80)
    
    # Login as admin
    print("\n=== LOGIN AS ADMIN ===")
    admin_token = login(ADMIN_EMAIL, ADMIN_PASSWORD)
    if not admin_token:
        print("❌ FATAL: Could not login as admin")
        sys.exit(1)
    print(f"✅ Admin login successful")
    
    # Login as mandante user
    print("\n=== LOGIN AS MANDANTE USER ===")
    mandante_token = login(MANDANTE_EMAIL, MANDANTE_PASSWORD)
    if not mandante_token:
        print("❌ FATAL: Could not login as mandante user")
        sys.exit(1)
    print(f"✅ Mandante user login successful")
    
    # Run all tests
    results = []
    results.append(("Test 1: POST punto con slug", test_1_post_punto_with_slug()))
    results.append(("Test 2: POST punto duplicado (slug único -2)", test_2_post_duplicate_nombre()))
    results.append(("Test 3: GET público por slug", test_3_get_public_punto_by_slug()))
    results.append(("Test 4: GET público slug inexistente (404)", test_4_get_public_punto_not_found()))
    results.append(("Test 5: GET público sin slug (400)", test_5_get_public_punto_no_slug()))
    results.append(("Test 6: PUT inactivo + GET público (403)", test_6_put_punto_inactive_then_get_403()))
    results.append(("Test 7: GET público puntos incluye slug", test_7_get_public_puntos_includes_slug()))
    results.append(("Test 8a: Seguridad sin token (401)", test_8_security_no_token()))
    results.append(("Test 8b: Seguridad usuario mandante (403)", test_8b_security_mandante_user()))
    results.append(("Test 9: Cleanup (DELETE puntos)", test_9_cleanup()))
    
    # Summary
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for name, result in results:
        status = "✅ PASSED" if result else "❌ FAILED"
        print(f"{status}: {name}")
    
    print(f"\nTotal: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 ALL TESTS PASSED! Slug functionality is working correctly.")
        sys.exit(0)
    else:
        print(f"\n⚠️  {total - passed} test(s) failed. Review the output above.")
        sys.exit(1)

if __name__ == "__main__":
    main()
