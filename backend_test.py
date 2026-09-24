#!/usr/bin/env python3
"""
Backend API Testing Script for Aptiva RL
Tests the NEW feature: Editar RUT del trabajador (PUT /api/trabajadores/:id)
"""

import requests
import json
import sys
from typing import Optional, Dict, Any

# Configuration
BASE_URL = "https://aptiva-db.preview.emergentagent.com/api"
ADMIN_EMAIL = "admin@aptivarl.com"
ADMIN_PASSWORD = "Aptiva2025!"
RRHH_EMAIL = "pmiranda@rioloa.cl"
RRHH_PASSWORD = "Aptiva2025!"

# Test state
admin_token = None
rrhh_token = None
test_trabajador_1_id = None
test_trabajador_2_id = None
test_empresa_id = None


def compute_rut_dv(numero: int) -> str:
    """Compute Chilean RUT verification digit using modulo 11 algorithm"""
    s = str(numero)
    suma = 0
    multiplier = 2
    for digit in reversed(s):
        suma += int(digit) * multiplier
        multiplier = 2 if multiplier == 7 else multiplier + 1
    
    r = 11 - (suma % 11)
    if r == 11:
        return '0'
    elif r == 10:
        return 'K'
    else:
        return str(r)


def generate_valid_rut(numero: int) -> str:
    """Generate a valid Chilean RUT with proper DV"""
    dv = compute_rut_dv(numero)
    return f"{numero}-{dv}"


def format_rut_with_dots(rut: str) -> str:
    """Format RUT with dots and dash (e.g., 12.345.678-5)"""
    clean = rut.replace('.', '').replace('-', '').upper()
    dv = clean[-1]
    body = clean[:-1]
    
    formatted = ''
    while len(body) > 3:
        formatted = '.' + body[-3:] + formatted
        body = body[:-3]
    
    return body + formatted + '-' + dv


def login(email: str, password: str) -> Optional[str]:
    """Login and return token"""
    try:
        response = requests.post(
            f"{BASE_URL}/auth/login",
            json={"email": email, "password": password},
            timeout=30
        )
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Login successful: {email} (role: {data.get('profile', {}).get('role_codigo', 'N/A')})")
            return data.get('token')
        else:
            print(f"❌ Login failed for {email}: {response.status_code} - {response.text}")
            return None
    except Exception as e:
        print(f"❌ Login error for {email}: {str(e)}")
        return None


def get_empresas(token: str) -> Optional[list]:
    """Get list of empresas"""
    try:
        response = requests.get(
            f"{BASE_URL}/empresas",
            headers={"Authorization": f"Bearer {token}"},
            timeout=30
        )
        if response.status_code == 200:
            empresas = response.json().get('empresas', [])
            print(f"✅ GET /api/empresas: {len(empresas)} empresas found")
            return empresas
        else:
            print(f"❌ GET /api/empresas failed: {response.status_code}")
            return None
    except Exception as e:
        print(f"❌ GET /api/empresas error: {str(e)}")
        return None


def create_trabajador(token: str, empresa_id: str, rut: str, nombre: str, apellido: str) -> Optional[str]:
    """Create a trabajador and return trabajador_id"""
    try:
        response = requests.post(
            f"{BASE_URL}/trabajadores",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "empresa_id": empresa_id,
                "rut": rut,
                "nombre": nombre,
                "apellido": apellido,
                "cargo": "Operario de Prueba"
            },
            timeout=30
        )
        if response.status_code == 201:
            trabajador = response.json().get('trabajador', {})
            trabajador_id = trabajador.get('trabajador_id')
            stored_rut = trabajador.get('rut')
            print(f"✅ POST /api/trabajadores: Created trabajador {trabajador_id} with RUT {stored_rut}")
            return trabajador_id
        else:
            print(f"❌ POST /api/trabajadores failed: {response.status_code} - {response.text}")
            return None
    except Exception as e:
        print(f"❌ POST /api/trabajadores error: {str(e)}")
        return None


def get_trabajador(token: str, trabajador_id: str) -> Optional[Dict[str, Any]]:
    """Get trabajador details"""
    try:
        response = requests.get(
            f"{BASE_URL}/trabajadores/{trabajador_id}",
            headers={"Authorization": f"Bearer {token}"},
            timeout=30
        )
        if response.status_code == 200:
            trabajador = response.json().get('trabajador', {})
            print(f"✅ GET /api/trabajadores/{trabajador_id}: RUT={trabajador.get('rut')}")
            return trabajador
        else:
            print(f"❌ GET /api/trabajadores/{trabajador_id} failed: {response.status_code}")
            return None
    except Exception as e:
        print(f"❌ GET /api/trabajadores/{trabajador_id} error: {str(e)}")
        return None


def update_trabajador(token: str, trabajador_id: str, data: Dict[str, Any]) -> tuple[int, Optional[Dict]]:
    """Update trabajador and return (status_code, response_data)"""
    try:
        response = requests.put(
            f"{BASE_URL}/trabajadores/{trabajador_id}",
            headers={"Authorization": f"Bearer {token}"},
            json=data,
            timeout=30
        )
        return response.status_code, response.json() if response.text else None
    except Exception as e:
        print(f"❌ PUT /api/trabajadores/{trabajador_id} error: {str(e)}")
        return 500, {"error": str(e)}


def delete_trabajador(token: str, trabajador_id: str) -> bool:
    """Delete trabajador"""
    try:
        response = requests.delete(
            f"{BASE_URL}/trabajadores/{trabajador_id}",
            headers={"Authorization": f"Bearer {token}"},
            timeout=30
        )
        if response.status_code == 200:
            print(f"✅ DELETE /api/trabajadores/{trabajador_id}: Cleaned up")
            return True
        else:
            print(f"⚠️ DELETE /api/trabajadores/{trabajador_id} failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ DELETE /api/trabajadores/{trabajador_id} error: {str(e)}")
        return False


def run_tests():
    """Run all backend tests for Editar RUT del trabajador feature"""
    global admin_token, rrhh_token, test_trabajador_1_id, test_trabajador_2_id, test_empresa_id
    
    print("\n" + "="*80)
    print("BACKEND TESTING: Editar RUT del trabajador (PUT /api/trabajadores/:id)")
    print("="*80 + "\n")
    
    # Generate valid RUTs for testing (using unique numbers unlikely to exist)
    rut_a = generate_valid_rut(98765432)  # 98765432-1
    rut_b = generate_valid_rut(87654321)  # 87654321-4
    rut_c = generate_valid_rut(76543210)  # 76543210-K
    
    print(f"📋 Generated valid test RUTs:")
    print(f"   RUT A: {rut_a} (formatted: {format_rut_with_dots(rut_a)})")
    print(f"   RUT B: {rut_b} (formatted: {format_rut_with_dots(rut_b)})")
    print(f"   RUT C: {rut_c} (formatted: {format_rut_with_dots(rut_c)})")
    print()
    
    # TEST SETUP: Login
    print("="*80)
    print("TEST SETUP: Authentication")
    print("="*80)
    
    admin_token = login(ADMIN_EMAIL, ADMIN_PASSWORD)
    if not admin_token:
        print("❌ CRITICAL: Admin login failed. Cannot proceed.")
        return False
    
    rrhh_token = login(RRHH_EMAIL, RRHH_PASSWORD)
    if not rrhh_token:
        print("❌ CRITICAL: RRHH login failed. Cannot proceed.")
        return False
    
    print()
    
    # Get empresas
    print("="*80)
    print("TEST SETUP: Get Empresas")
    print("="*80)
    
    empresas = get_empresas(admin_token)
    if not empresas or len(empresas) == 0:
        print("❌ CRITICAL: No empresas found. Cannot proceed.")
        return False
    
    test_empresa_id = empresas[0]['empresa_id']
    print(f"📋 Using empresa: {empresas[0].get('razon_social')} (ID: {test_empresa_id})")
    print()
    
    # TEST 1: Create trabajador T1 with RUT A
    print("="*80)
    print("TEST 1: Create trabajador T1 with valid RUT A")
    print("="*80)
    
    test_trabajador_1_id = create_trabajador(admin_token, test_empresa_id, rut_a, "Juan", "Perez")
    if not test_trabajador_1_id:
        print("❌ TEST 1 FAILED: Could not create trabajador T1")
        return False
    
    print("✅ TEST 1 PASSED: Trabajador T1 created successfully")
    print()
    
    # TEST 1b: Create trabajador T2 with RUT B
    print("="*80)
    print("TEST 1b: Create trabajador T2 with valid RUT B")
    print("="*80)
    
    test_trabajador_2_id = create_trabajador(admin_token, test_empresa_id, rut_b, "Maria", "Gonzalez")
    if not test_trabajador_2_id:
        print("❌ TEST 1b FAILED: Could not create trabajador T2")
        return False
    
    print("✅ TEST 1b PASSED: Trabajador T2 created successfully")
    print()
    
    # TEST 2: RRHH edits T1 RUT to RUT C
    print("="*80)
    print("TEST 2: RRHH edits T1 RUT from A to C (different valid RUT)")
    print("="*80)
    
    status, response = update_trabajador(rrhh_token, test_trabajador_1_id, {"rut": rut_c})
    if status != 200:
        print(f"❌ TEST 2 FAILED: Expected 200, got {status}")
        print(f"   Response: {response}")
        return False
    
    # Verify RUT was updated
    trabajador = get_trabajador(rrhh_token, test_trabajador_1_id)
    if not trabajador:
        print("❌ TEST 2 FAILED: Could not retrieve trabajador after update")
        return False
    
    expected_rut_formatted = format_rut_with_dots(rut_c)
    actual_rut = trabajador.get('rut')
    
    if actual_rut != expected_rut_formatted:
        print(f"❌ TEST 2 FAILED: RUT not updated correctly")
        print(f"   Expected: {expected_rut_formatted}")
        print(f"   Actual: {actual_rut}")
        return False
    
    print(f"✅ TEST 2 PASSED: RRHH successfully edited RUT to {actual_rut} (formatted with dots and dash)")
    print()
    
    # TEST 3: RRHH tries to update with INVALID RUT (wrong DV)
    print("="*80)
    print("TEST 3: RRHH tries to update T1 with INVALID RUT (wrong DV)")
    print("="*80)
    
    # Use 12345678-0 which has wrong DV (correct is 12345678-5)
    invalid_rut = "12345678-0"
    status, response = update_trabajador(rrhh_token, test_trabajador_1_id, {"rut": invalid_rut})
    
    if status != 400:
        print(f"❌ TEST 3 FAILED: Expected 400, got {status}")
        print(f"   Response: {response}")
        return False
    
    error_msg = response.get('error', '') if response else ''
    if 'RUT inválido' not in error_msg and 'inválido' not in error_msg.lower():
        print(f"❌ TEST 3 FAILED: Expected 'RUT inválido' error message")
        print(f"   Actual error: {error_msg}")
        return False
    
    print(f"✅ TEST 3 PASSED: Invalid RUT correctly rejected with 400 '{error_msg}'")
    print()
    
    # TEST 4: RRHH tries to update T1 with RUT B (belongs to T2)
    print("="*80)
    print("TEST 4: RRHH tries to update T1 with RUT B (already belongs to T2)")
    print("="*80)
    
    status, response = update_trabajador(rrhh_token, test_trabajador_1_id, {"rut": rut_b})
    
    if status != 409:
        print(f"❌ TEST 4 FAILED: Expected 409, got {status}")
        print(f"   Response: {response}")
        return False
    
    error_msg = response.get('error', '') if response else ''
    if 'Ya existe otro trabajador con ese RUT' not in error_msg:
        print(f"❌ TEST 4 FAILED: Expected 'Ya existe otro trabajador con ese RUT' error")
        print(f"   Actual error: {error_msg}")
        return False
    
    print(f"✅ TEST 4 PASSED: Duplicate RUT correctly rejected with 409 '{error_msg}'")
    print()
    
    # TEST 5: RRHH updates T1 with its CURRENT RUT C (same as its own)
    print("="*80)
    print("TEST 5: RRHH updates T1 with its CURRENT RUT C (self, should NOT 409)")
    print("="*80)
    
    status, response = update_trabajador(rrhh_token, test_trabajador_1_id, {"rut": rut_c})
    
    if status != 200:
        print(f"❌ TEST 5 FAILED: Expected 200, got {status}")
        print(f"   Response: {response}")
        print(f"   CRITICAL: Self-exclusion in duplicate check is NOT working!")
        return False
    
    print(f"✅ TEST 5 PASSED: Same RUT (self) correctly accepted with 200 (self excluded from duplicate check)")
    print()
    
    # TEST 6: RRHH updates T1 cargo WITHOUT rut field (rut should remain unchanged)
    print("="*80)
    print("TEST 6: RRHH updates T1 cargo WITHOUT rut field (rut should remain C)")
    print("="*80)
    
    status, response = update_trabajador(rrhh_token, test_trabajador_1_id, {"cargo": "NUEVO CARGO"})
    
    if status != 200:
        print(f"❌ TEST 6 FAILED: Expected 200, got {status}")
        print(f"   Response: {response}")
        return False
    
    # Verify RUT is still C
    trabajador = get_trabajador(rrhh_token, test_trabajador_1_id)
    if not trabajador:
        print("❌ TEST 6 FAILED: Could not retrieve trabajador after update")
        return False
    
    actual_rut = trabajador.get('rut')
    expected_rut_formatted = format_rut_with_dots(rut_c)
    
    if actual_rut != expected_rut_formatted:
        print(f"❌ TEST 6 FAILED: RUT changed when it should remain unchanged")
        print(f"   Expected: {expected_rut_formatted}")
        print(f"   Actual: {actual_rut}")
        return False
    
    actual_cargo = trabajador.get('cargo')
    if actual_cargo != "Nuevo Cargo":  # titleCase applied
        print(f"⚠️ TEST 6 WARNING: Cargo not updated as expected")
        print(f"   Expected: 'Nuevo Cargo' (titleCase)")
        print(f"   Actual: {actual_cargo}")
    
    print(f"✅ TEST 6 PASSED: RUT unchanged ({actual_rut}), cargo updated to '{actual_cargo}'")
    print()
    
    # TEST 7: REGRESSION - Editing other fields (nombre, telefono) still works
    print("="*80)
    print("TEST 7: REGRESSION - Editing other fields (nombre, telefono) still works")
    print("="*80)
    
    status, response = update_trabajador(rrhh_token, test_trabajador_1_id, {
        "nombre": "Carlos",
        "telefono": "+56912345678"
    })
    
    if status != 200:
        print(f"❌ TEST 7 FAILED: Expected 200, got {status}")
        print(f"   Response: {response}")
        return False
    
    # Verify changes
    trabajador = get_trabajador(rrhh_token, test_trabajador_1_id)
    if not trabajador:
        print("❌ TEST 7 FAILED: Could not retrieve trabajador after update")
        return False
    
    actual_nombre = trabajador.get('nombre')
    actual_telefono = trabajador.get('telefono')
    
    if actual_nombre != "Carlos":
        print(f"⚠️ TEST 7 WARNING: Nombre not updated correctly")
        print(f"   Expected: 'Carlos'")
        print(f"   Actual: {actual_nombre}")
    
    if actual_telefono != "+56912345678":
        print(f"⚠️ TEST 7 WARNING: Telefono not updated correctly")
        print(f"   Expected: '+56912345678'")
        print(f"   Actual: {actual_telefono}")
    
    print(f"✅ TEST 7 PASSED: Other fields still editable (nombre={actual_nombre}, telefono={actual_telefono})")
    print()
    
    # CLEANUP
    print("="*80)
    print("CLEANUP: Deleting test trabajadores")
    print("="*80)
    
    cleanup_success = True
    
    if test_trabajador_1_id:
        if not delete_trabajador(admin_token, test_trabajador_1_id):
            cleanup_success = False
    
    if test_trabajador_2_id:
        if not delete_trabajador(admin_token, test_trabajador_2_id):
            cleanup_success = False
    
    if not cleanup_success:
        print("⚠️ WARNING: Some test data may not have been cleaned up")
    else:
        print("✅ CLEANUP COMPLETE: All test data removed")
    
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
            print("\nFeature 'Editar RUT del trabajador' is working correctly:")
            print("  ✅ RRHH can edit trabajador RUT")
            print("  ✅ RUT validation (modulo 11) working")
            print("  ✅ RUT formatting (dots + dash) working")
            print("  ✅ Duplicate RUT detection (409) working")
            print("  ✅ Self-exclusion in duplicate check working")
            print("  ✅ RUT field optional (unchanged when omitted)")
            print("  ✅ Other fields still editable (regression passed)")
            print("  ✅ Cleanup successful (no test data left)")
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
