#!/usr/bin/env python3
"""
Backend API Testing for Aptiva RL - Regression Test
Testing mandantes array field in vehiculos and equipos lists
"""

import requests
import json
import sys

BASE_URL = "https://aptiva-db.preview.emergentagent.com/api"

def test_regression_mandantes_array():
    """
    Regression test for mandantes array in vehiculos and equipos lists.
    Review request: Verify GET /api/vehiculos and GET /api/equipos include mandantes array
    with active assigned mandantes (razon_social).
    """
    print("=" * 80)
    print("APTIVA RL - REGRESSION TEST: MANDANTES ARRAY IN VEHICULOS/EQUIPOS")
    print("=" * 80)
    
    # Step 1: Login as admin@aptivarl.com / Aptiva2025!
    print("\n[1] LOGIN as admin@aptivarl.com")
    try:
        login_response = requests.post(
            f"{BASE_URL}/auth/login",
            json={"email": "admin@aptivarl.com", "password": "Aptiva2025!"},
            timeout=30
        )
        print(f"    Status: {login_response.status_code}")
        
        if login_response.status_code != 200:
            print(f"    ❌ FAILED: Login failed with status {login_response.status_code}")
            print(f"    Response: {login_response.text}")
            return False
        
        login_data = login_response.json()
        token = login_data.get("token")
        profile = login_data.get("profile", {})
        
        if not token:
            print("    ❌ FAILED: No token in login response")
            return False
        
        print(f"    ✅ SUCCESS: Logged in as {profile.get('email')} (Role: {profile.get('role_codigo')})")
        
    except Exception as e:
        print(f"    ❌ EXCEPTION during login: {e}")
        return False
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # Step 2: GET /api/vehiculos - verify mandantes array
    print("\n[2] GET /api/vehiculos - Verify mandantes array field")
    try:
        vehiculos_response = requests.get(f"{BASE_URL}/vehiculos", headers=headers, timeout=30)
        print(f"    Status: {vehiculos_response.status_code}")
        
        if vehiculos_response.status_code != 200:
            print(f"    ❌ FAILED: GET /api/vehiculos returned {vehiculos_response.status_code}")
            print(f"    Response: {vehiculos_response.text}")
            return False
        
        vehiculos_data = vehiculos_response.json()
        vehiculos = vehiculos_data.get("vehiculos", [])
        
        if not vehiculos:
            print("    ⚠️  WARNING: No vehiculos found in response")
            return False
        
        print(f"    ✅ SUCCESS: Retrieved {len(vehiculos)} vehiculos")
        
        # Verify each vehiculo has mandantes array, estado_operativo, operador_actual
        missing_mandantes = []
        missing_estado_operativo = []
        missing_operador_actual = []
        vehiculos_with_mandantes = []
        
        for v in vehiculos:
            if "mandantes" not in v:
                missing_mandantes.append(v.get("vehiculo_id", "unknown"))
            elif not isinstance(v["mandantes"], list):
                print(f"    ❌ FAILED: vehiculo {v.get('patente', 'unknown')} has mandantes but it's not an array: {type(v['mandantes'])}")
                return False
            elif len(v["mandantes"]) > 0:
                vehiculos_with_mandantes.append({
                    "patente": v.get("patente"),
                    "mandantes": v["mandantes"],
                    "count": len(v["mandantes"])
                })
            
            if "estado_operativo" not in v:
                missing_estado_operativo.append(v.get("vehiculo_id", "unknown"))
            
            if "operador_actual" not in v:
                missing_operador_actual.append(v.get("vehiculo_id", "unknown"))
        
        if missing_mandantes:
            print(f"    ❌ FAILED: {len(missing_mandantes)} vehiculos missing 'mandantes' field")
            return False
        
        if missing_estado_operativo:
            print(f"    ❌ FAILED: {len(missing_estado_operativo)} vehiculos missing 'estado_operativo' field")
            return False
        
        if missing_operador_actual:
            print(f"    ❌ FAILED: {len(missing_operador_actual)} vehiculos missing 'operador_actual' field")
            return False
        
        print(f"    ✅ All vehiculos have 'mandantes' array field")
        print(f"    ✅ All vehiculos have 'estado_operativo' field")
        print(f"    ✅ All vehiculos have 'operador_actual' field")
        
        if vehiculos_with_mandantes:
            print(f"    ✅ Found {len(vehiculos_with_mandantes)} vehiculos with active mandante assignments:")
            for v in vehiculos_with_mandantes[:3]:  # Show first 3
                print(f"       - {v['patente']}: {v['count']} mandante(s) -> {v['mandantes']}")
        else:
            print(f"    ⚠️  WARNING: No vehiculos have active mandante assignments (all mandantes arrays are empty)")
        
        # Sample one vehiculo for detailed inspection
        sample_vehiculo = vehiculos[0]
        print(f"\n    Sample vehiculo (patente: {sample_vehiculo.get('patente')}):")
        print(f"       - mandantes: {sample_vehiculo.get('mandantes')} (type: {type(sample_vehiculo.get('mandantes'))})")
        print(f"       - estado_operativo: {sample_vehiculo.get('estado_operativo')}")
        print(f"       - operador_actual: {sample_vehiculo.get('operador_actual')}")
        
    except Exception as e:
        print(f"    ❌ EXCEPTION during GET /api/vehiculos: {e}")
        return False
    
    # Step 3: GET /api/equipos - verify mandantes array
    print("\n[3] GET /api/equipos - Verify mandantes array field")
    try:
        equipos_response = requests.get(f"{BASE_URL}/equipos", headers=headers, timeout=30)
        print(f"    Status: {equipos_response.status_code}")
        
        if equipos_response.status_code != 200:
            print(f"    ❌ FAILED: GET /api/equipos returned {equipos_response.status_code}")
            print(f"    Response: {equipos_response.text}")
            return False
        
        equipos_data = equipos_response.json()
        equipos = equipos_data.get("equipos", [])
        
        if not equipos:
            print("    ⚠️  WARNING: No equipos found in response")
            return False
        
        print(f"    ✅ SUCCESS: Retrieved {len(equipos)} equipos")
        
        # Verify each equipo has mandantes array
        missing_mandantes = []
        equipos_with_mandantes = []
        
        for e in equipos:
            if "mandantes" not in e:
                missing_mandantes.append(e.get("equipo_id", "unknown"))
            elif not isinstance(e["mandantes"], list):
                print(f"    ❌ FAILED: equipo {e.get('codigo_interno', 'unknown')} has mandantes but it's not an array: {type(e['mandantes'])}")
                return False
            elif len(e["mandantes"]) > 0:
                equipos_with_mandantes.append({
                    "codigo": e.get("codigo_interno"),
                    "mandantes": e["mandantes"],
                    "count": len(e["mandantes"])
                })
        
        if missing_mandantes:
            print(f"    ❌ FAILED: {len(missing_mandantes)} equipos missing 'mandantes' field")
            return False
        
        print(f"    ✅ All equipos have 'mandantes' array field")
        
        if equipos_with_mandantes:
            print(f"    ✅ Found {len(equipos_with_mandantes)} equipos with active mandante assignments:")
            for e in equipos_with_mandantes[:3]:  # Show first 3
                print(f"       - {e['codigo']}: {e['count']} mandante(s) -> {e['mandantes']}")
        else:
            print(f"    ⚠️  WARNING: No equipos have active mandante assignments (all mandantes arrays are empty)")
        
        # Sample one equipo for detailed inspection
        sample_equipo = equipos[0]
        print(f"\n    Sample equipo (codigo: {sample_equipo.get('codigo_interno')}):")
        print(f"       - mandantes: {sample_equipo.get('mandantes')} (type: {type(sample_equipo.get('mandantes'))})")
        print(f"       - estado_operativo: {sample_equipo.get('estado_operativo')}")
        print(f"       - operador_actual: {sample_equipo.get('operador_actual')}")
        
    except Exception as e:
        print(f"    ❌ EXCEPTION during GET /api/equipos: {e}")
        return False
    
    # Step 4: PUT /api/vehiculos/{id} - update marca, verify, revert
    print("\n[4] PUT /api/vehiculos/{id} - Update marca, verify, then revert")
    try:
        # Pick first vehiculo
        test_vehiculo = vehiculos[0]
        vehiculo_id = test_vehiculo.get("vehiculo_id")
        original_marca = test_vehiculo.get("marca")
        patente = test_vehiculo.get("patente")
        
        print(f"    Testing with vehiculo: {patente} (ID: {vehiculo_id})")
        print(f"    Original marca: {original_marca}")
        
        # Update marca to "TEST-MARCA"
        print(f"\n    [4a] PUT /api/vehiculos/{vehiculo_id} - Update marca to 'TEST-MARCA'")
        update_response = requests.put(
            f"{BASE_URL}/vehiculos/{vehiculo_id}",
            headers=headers,
            json={"marca": "TEST-MARCA"},
            timeout=30
        )
        print(f"         Status: {update_response.status_code}")
        
        if update_response.status_code != 200:
            print(f"         ❌ FAILED: PUT returned {update_response.status_code}")
            print(f"         Response: {update_response.text}")
            return False
        
        print(f"         ✅ SUCCESS: Updated marca to 'TEST-MARCA'")
        
        # Verify change via GET
        print(f"\n    [4b] GET /api/vehiculos/{vehiculo_id} - Verify marca change")
        verify_response = requests.get(f"{BASE_URL}/vehiculos/{vehiculo_id}", headers=headers, timeout=30)
        print(f"         Status: {verify_response.status_code}")
        
        if verify_response.status_code != 200:
            print(f"         ❌ FAILED: GET returned {verify_response.status_code}")
            return False
        
        verify_data = verify_response.json()
        current_marca = verify_data.get("recurso", {}).get("marca")
        
        if current_marca != "TEST-MARCA":
            print(f"         ❌ FAILED: marca not updated. Expected 'TEST-MARCA', got '{current_marca}'")
            return False
        
        print(f"         ✅ SUCCESS: Verified marca = 'TEST-MARCA'")
        
        # Revert to original marca
        print(f"\n    [4c] PUT /api/vehiculos/{vehiculo_id} - Revert marca to original value '{original_marca}'")
        revert_response = requests.put(
            f"{BASE_URL}/vehiculos/{vehiculo_id}",
            headers=headers,
            json={"marca": original_marca},
            timeout=30
        )
        print(f"         Status: {revert_response.status_code}")
        
        if revert_response.status_code != 200:
            print(f"         ❌ FAILED: PUT revert returned {revert_response.status_code}")
            print(f"         Response: {revert_response.text}")
            return False
        
        print(f"         ✅ SUCCESS: Reverted marca to '{original_marca}'")
        
        # Verify revert via GET
        print(f"\n    [4d] GET /api/vehiculos/{vehiculo_id} - Verify marca reverted")
        final_verify_response = requests.get(f"{BASE_URL}/vehiculos/{vehiculo_id}", headers=headers, timeout=30)
        print(f"         Status: {final_verify_response.status_code}")
        
        if final_verify_response.status_code != 200:
            print(f"         ❌ FAILED: GET returned {final_verify_response.status_code}")
            return False
        
        final_verify_data = final_verify_response.json()
        final_marca = final_verify_data.get("recurso", {}).get("marca")
        
        if final_marca != original_marca:
            print(f"         ❌ FAILED: marca not reverted. Expected '{original_marca}', got '{final_marca}'")
            return False
        
        print(f"         ✅ SUCCESS: Verified marca reverted to '{original_marca}'")
        
    except Exception as e:
        print(f"    ❌ EXCEPTION during PUT /api/vehiculos: {e}")
        return False
    
    # Step 5: GET /api/dashboard - regression check
    print("\n[5] GET /api/dashboard - Regression check")
    try:
        dashboard_response = requests.get(f"{BASE_URL}/dashboard", headers=headers, timeout=30)
        print(f"    Status: {dashboard_response.status_code}")
        
        if dashboard_response.status_code != 200:
            print(f"    ❌ FAILED: GET /api/dashboard returned {dashboard_response.status_code}")
            print(f"    Response: {dashboard_response.text}")
            return False
        
        dashboard_data = dashboard_response.json()
        stats = dashboard_data.get("stats", {})
        
        print(f"    ✅ SUCCESS: Dashboard returned 200")
        print(f"    Stats: mandantes={stats.get('mandantes')}, contratos_vigentes={stats.get('contratos_vigentes')}, trabajadores={stats.get('trabajadores')}")
        
    except Exception as e:
        print(f"    ❌ EXCEPTION during GET /api/dashboard: {e}")
        return False
    
    print("\n" + "=" * 80)
    print("✅ ALL REGRESSION TESTS PASSED")
    print("=" * 80)
    return True


if __name__ == "__main__":
    success = test_regression_mandantes_array()
    sys.exit(0 if success else 1)
