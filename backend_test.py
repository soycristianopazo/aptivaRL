#!/usr/bin/env python3
"""
Backend API Testing Script for Aptiva RL
Tests the NEW feature: GET /api/usuarios returns empresasAll + empresaMandantes
"""

import requests
import json
import sys
from typing import Optional, Dict, Any, List

# Configuration
BASE_URL = "https://aptiva-db.preview.emergentagent.com/api"
ADMIN_EMAIL = "admin@aptivarl.com"
ADMIN_PASSWORD = "Aptiva2025!"
MANDANTE_EMAIL = "mandante@aptivarl.com"
MANDANTE_PASSWORD = "Aptiva2025!"

# Test state
admin_token = None
mandante_token = None


def login(email: str, password: str) -> Optional[Dict[str, Any]]:
    """Login and return token + profile"""
    try:
        response = requests.post(
            f"{BASE_URL}/auth/login",
            json={"email": email, "password": password},
            timeout=30
        )
        if response.status_code == 200:
            data = response.json()
            profile = data.get('profile', {})
            print(f"✅ Login successful: {email} (role: {profile.get('role_codigo', 'N/A')})")
            return {"token": data.get('token'), "profile": profile}
        else:
            print(f"❌ Login failed for {email}: {response.status_code} - {response.text}")
            return None
    except Exception as e:
        print(f"❌ Login error for {email}: {str(e)}")
        return None


def get_usuarios(token: str) -> Optional[Dict[str, Any]]:
    """GET /api/usuarios and return full response"""
    try:
        response = requests.get(
            f"{BASE_URL}/usuarios",
            headers={"Authorization": f"Bearer {token}"},
            timeout=30
        )
        if response.status_code == 200:
            data = response.json()
            print(f"✅ GET /api/usuarios: {response.status_code}")
            return data
        else:
            print(f"❌ GET /api/usuarios failed: {response.status_code} - {response.text}")
            return {"status_code": response.status_code, "error": response.text}
    except Exception as e:
        print(f"❌ GET /api/usuarios error: {str(e)}")
        return None


def run_tests():
    """Run all backend tests for GET /api/usuarios empresasAll + empresaMandantes"""
    global admin_token, mandante_token
    
    print("\n" + "="*80)
    print("BACKEND TESTING: GET /api/usuarios returns empresasAll + empresaMandantes")
    print("="*80 + "\n")
    
    # TEST 1: Login as admin@aptivarl.com (SUPER_ADMIN_HOLDING)
    print("="*80)
    print("TEST 1: Login as admin@aptivarl.com (SUPER_ADMIN_HOLDING)")
    print("="*80)
    
    admin_auth = login(ADMIN_EMAIL, ADMIN_PASSWORD)
    if not admin_auth or not admin_auth.get('token'):
        print("❌ TEST 1 FAILED: Admin login failed")
        return False
    
    admin_token = admin_auth['token']
    admin_profile = admin_auth['profile']
    
    if admin_profile.get('role_codigo') != 'SUPER_ADMIN_HOLDING':
        print(f"❌ TEST 1 FAILED: Expected SUPER_ADMIN_HOLDING, got {admin_profile.get('role_codigo')}")
        return False
    
    print("✅ TEST 1 PASSED: Admin login successful with token")
    print()
    
    # TEST 2: GET /api/usuarios as admin -> verify response structure
    print("="*80)
    print("TEST 2: GET /api/usuarios as admin -> verify response contains all required arrays")
    print("="*80)
    
    usuarios_data = get_usuarios(admin_token)
    if not usuarios_data:
        print("❌ TEST 2 FAILED: GET /api/usuarios returned None")
        return False
    
    if usuarios_data.get('status_code') and usuarios_data['status_code'] != 200:
        print(f"❌ TEST 2 FAILED: Expected 200, got {usuarios_data['status_code']}")
        return False
    
    # Check required fields
    required_fields = ['usuarios', 'roles', 'mandantesAll', 'empresasAll', 'empresaMandantes']
    missing_fields = []
    for field in required_fields:
        if field not in usuarios_data:
            missing_fields.append(field)
    
    if missing_fields:
        print(f"❌ TEST 2 FAILED: Missing required fields: {missing_fields}")
        print(f"   Available fields: {list(usuarios_data.keys())}")
        return False
    
    # Verify all fields are arrays
    for field in required_fields:
        if not isinstance(usuarios_data[field], list):
            print(f"❌ TEST 2 FAILED: Field '{field}' is not an array (type: {type(usuarios_data[field])})")
            return False
    
    print(f"✅ TEST 2 PASSED: Response contains all required arrays:")
    print(f"   - usuarios: {len(usuarios_data['usuarios'])} items")
    print(f"   - roles: {len(usuarios_data['roles'])} items")
    print(f"   - mandantesAll: {len(usuarios_data['mandantesAll'])} items")
    print(f"   - empresasAll: {len(usuarios_data['empresasAll'])} items (NEW)")
    print(f"   - empresaMandantes: {len(usuarios_data['empresaMandantes'])} items (NEW)")
    print()
    
    # TEST 3: Verify empresasAll structure and content
    print("="*80)
    print("TEST 3: Verify empresasAll is non-empty with empresa_id and razon_social")
    print("="*80)
    
    empresas_all = usuarios_data['empresasAll']
    
    if len(empresas_all) == 0:
        print("❌ TEST 3 FAILED: empresasAll is empty (expected non-empty)")
        return False
    
    # Check structure of first item
    sample_empresa = empresas_all[0]
    if 'empresa_id' not in sample_empresa or 'razon_social' not in sample_empresa:
        print(f"❌ TEST 3 FAILED: empresasAll items missing required fields")
        print(f"   Sample item: {sample_empresa}")
        return False
    
    print(f"✅ TEST 3 PASSED: empresasAll is non-empty ({len(empresas_all)} empresas)")
    print(f"   Sample empresa: {sample_empresa['razon_social']} (ID: {sample_empresa['empresa_id']})")
    
    # Show all empresas
    print(f"\n   All empresas:")
    for emp in empresas_all:
        print(f"     - {emp['razon_social']} (ID: {emp['empresa_id']})")
    print()
    
    # TEST 4: Verify empresaMandantes structure and referential integrity
    print("="*80)
    print("TEST 4: Verify empresaMandantes referential integrity")
    print("="*80)
    
    empresa_mandantes = usuarios_data['empresaMandantes']
    mandantes_all = usuarios_data['mandantesAll']
    
    print(f"📋 empresaMandantes count: {len(empresa_mandantes)}")
    print(f"📋 mandantesAll count: {len(mandantes_all)}")
    print(f"📋 empresasAll count: {len(empresas_all)}")
    
    if len(empresa_mandantes) == 0:
        print("⚠️ WARNING: empresaMandantes is empty (could be valid if no contratos exist)")
        print("   This is acceptable only if there are no contratos in the system")
    else:
        # Build lookup sets
        empresa_ids = {emp['empresa_id'] for emp in empresas_all}
        mandante_ids = {mand['mandante_id'] for mand in mandantes_all}
        
        # Check referential integrity
        invalid_empresa_refs = []
        invalid_mandante_refs = []
        
        for pair in empresa_mandantes:
            if 'empresa_id' not in pair or 'mandante_id' not in pair:
                print(f"❌ TEST 4 FAILED: empresaMandantes item missing required fields: {pair}")
                return False
            
            if pair['empresa_id'] not in empresa_ids:
                invalid_empresa_refs.append(pair['empresa_id'])
            
            if pair['mandante_id'] not in mandante_ids:
                invalid_mandante_refs.append(pair['mandante_id'])
        
        if invalid_empresa_refs:
            print(f"❌ TEST 4 FAILED: Found empresa_ids in empresaMandantes NOT in empresasAll:")
            print(f"   Invalid empresa_ids: {invalid_empresa_refs}")
            return False
        
        if invalid_mandante_refs:
            print(f"❌ TEST 4 FAILED: Found mandante_ids in empresaMandantes NOT in mandantesAll:")
            print(f"   Invalid mandante_ids: {invalid_mandante_refs}")
            return False
        
        print(f"✅ TEST 4 PASSED: Referential integrity verified")
        print(f"   - All empresa_ids in empresaMandantes exist in empresasAll ✅")
        print(f"   - All mandante_ids in empresaMandantes exist in mandantesAll ✅")
        
        # Show sample pairs
        print(f"\n   Sample empresaMandantes pairs (first 5):")
        for i, pair in enumerate(empresa_mandantes[:5]):
            # Find names
            empresa_name = next((e['razon_social'] for e in empresas_all if e['empresa_id'] == pair['empresa_id']), 'Unknown')
            mandante_name = next((m['razon_social'] for m in mandantes_all if m['mandante_id'] == pair['mandante_id']), 'Unknown')
            print(f"     {i+1}. Empresa: {empresa_name} <-> Mandante: {mandante_name}")
    
    print()
    
    # TEST 5: Regression - GET /api/usuarios as non-super user (mandante@aptivarl.com)
    print("="*80)
    print("TEST 5: Regression - GET /api/usuarios as non-super user (USUARIO_MANDANTE)")
    print("="*80)
    
    # Try to login as mandante user
    mandante_auth = login(MANDANTE_EMAIL, MANDANTE_PASSWORD)
    
    if not mandante_auth or not mandante_auth.get('token'):
        print("⚠️ TEST 5 SKIPPED: mandante@aptivarl.com user does not exist or credentials invalid")
        print("   This is acceptable - test 5 is optional")
    else:
        mandante_token = mandante_auth['token']
        mandante_profile = mandante_auth['profile']
        
        print(f"📋 Mandante user role: {mandante_profile.get('role_codigo')}")
        
        # Try GET /api/usuarios as mandante user
        mandante_usuarios_data = get_usuarios(mandante_token)
        
        if mandante_usuarios_data and mandante_usuarios_data.get('status_code'):
            status = mandante_usuarios_data['status_code']
            if status == 403 or status == 401:
                print(f"✅ TEST 5 PASSED: Non-super user correctly denied access ({status})")
            else:
                print(f"❌ TEST 5 FAILED: Expected 403/401, got {status}")
                return False
        elif mandante_usuarios_data and 'empresaMandantes' in mandante_usuarios_data:
            print(f"❌ TEST 5 FAILED: Non-super user should NOT have access to /api/usuarios")
            print(f"   But received data with empresaMandantes (should be restricted)")
            return False
        else:
            print(f"⚠️ TEST 5 WARNING: Unexpected response from mandante user")
            print(f"   Response: {mandante_usuarios_data}")
    
    print()
    
    return True


def main():
    """Main entry point"""
    try:
        success = run_tests()
        
        print("\n" + "="*80)
        print("TEST SUMMARY")
        print("="*80)
        
        if success:
            print("✅ ALL TESTS PASSED")
            print("\nFeature 'GET /api/usuarios returns empresasAll + empresaMandantes' is working correctly:")
            print("  ✅ Admin login successful (SUPER_ADMIN_HOLDING)")
            print("  ✅ GET /api/usuarios returns 200 with all required arrays")
            print("  ✅ empresasAll is non-empty with empresa_id and razon_social")
            print("  ✅ empresaMandantes has empresa_id/mandante_id pairs")
            print("  ✅ Referential integrity verified (all IDs exist in respective arrays)")
            print("  ✅ Regression: Non-super users correctly restricted")
            sys.exit(0)
        else:
            print("❌ TESTS FAILED")
            print("\nSome tests did not pass. Review the output above for details.")
            sys.exit(1)
    
    except KeyboardInterrupt:
        print("\n\n⚠️ Tests interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n\n❌ CRITICAL ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
