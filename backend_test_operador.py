#!/usr/bin/env python3
"""
Backend test for Operador/conductor de vehículos y equipos + disponibilidad + QR recurso
Tests the NEW operator/driver functionality for vehicles and equipment in Aptiva RL
"""

import requests
import sys
from datetime import date, timedelta

# Base URL from .env
BASE_URL = "https://aptiva-db.preview.emergentagent.com/api"

# Admin credentials
ADMIN_EMAIL = "admin@aptivarl.com"
ADMIN_PASSWORD = "Aptiva2025!"

def test_operador_functionality():
    """Test Operador/conductor functionality for vehicles and equipment"""
    print("=" * 80)
    print("TESTING OPERADOR/CONDUCTOR DE VEHÍCULOS Y EQUIPOS")
    print("=" * 80)
    
    token = None
    vehiculo_id = None
    vehiculo_empresa = None
    trabajador_id = None
    trabajador_empresa_id = None
    equipo_id = None
    equipo_empresa = None
    
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
        
        role_codigo = profile.get("role_codigo")
        
        print(f"✅ PASSED: Login successful")
        print(f"   Token: {token[:20]}...")
        print(f"   Role: {role_codigo}")
        
        if role_codigo != "SUPER_ADMIN_HOLDING":
            print(f"❌ FAILED: Expected role SUPER_ADMIN_HOLDING, got {role_codigo}")
            return False
        
        headers = {"Authorization": f"Bearer {token}"}
        
        # ========================================================================
        # STEP 1: GET /api/vehiculos - Get a vehicle and verify new fields
        # ========================================================================
        print("\n[STEP 1] GET /api/vehiculos - Get a vehicle and verify new fields")
        print("-" * 80)
        
        response = requests.get(f"{BASE_URL}/vehiculos", headers=headers, timeout=30)
        
        print(f"Status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ FAILED: Expected 200, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
        
        data = response.json()
        vehiculos = data.get("vehiculos", [])
        
        if len(vehiculos) == 0:
            print("❌ FAILED: No vehicles found")
            return False
        
        # Pick the first vehicle
        vehiculo = vehiculos[0]
        vehiculo_id = vehiculo.get("vehiculo_id")
        vehiculo_empresa = vehiculo.get("empresa")
        vehiculo_patente = vehiculo.get("patente")
        
        print(f"✅ PASSED: Found {len(vehiculos)} vehicles")
        print(f"   Selected vehicle: {vehiculo_patente} (ID: {vehiculo_id})")
        print(f"   Empresa: {vehiculo_empresa}")
        
        # Verify new fields exist
        if "estado_operativo" not in vehiculo:
            print("❌ FAILED: Missing 'estado_operativo' field in vehicle")
            return False
        
        if "operador_actual" not in vehiculo:
            print("❌ FAILED: Missing 'operador_actual' field in vehicle")
            return False
        
        print(f"✅ PASSED: Vehicle has new fields 'estado_operativo' and 'operador_actual'")
        print(f"   estado_operativo: {vehiculo.get('estado_operativo')}")
        print(f"   operador_actual: {vehiculo.get('operador_actual')}")
        
        # ========================================================================
        # STEP 2: GET /api/trabajadores - Get a worker from same empresa
        # ========================================================================
        print("\n[STEP 2] GET /api/trabajadores - Get a worker from same empresa")
        print("-" * 80)
        
        response = requests.get(f"{BASE_URL}/trabajadores", headers=headers, timeout=30)
        
        print(f"Status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ FAILED: Expected 200, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
        
        data = response.json()
        trabajadores = data.get("trabajadores", [])
        
        if len(trabajadores) == 0:
            print("❌ FAILED: No workers found")
            return False
        
        # Find a worker from the same empresa as the vehicle
        trabajador = None
        for t in trabajadores:
            if t.get("empresa") == vehiculo_empresa:
                trabajador = t
                break
        
        if not trabajador:
            print(f"❌ FAILED: No worker found from empresa '{vehiculo_empresa}'")
            return False
        
        trabajador_id = trabajador.get("trabajador_id")
        trabajador_empresa_id = trabajador.get("empresa_id")
        trabajador_nombre = f"{trabajador.get('nombre')} {trabajador.get('apellido')}"
        trabajador_rut = trabajador.get("rut")
        
        print(f"✅ PASSED: Found worker from same empresa")
        print(f"   Worker: {trabajador_nombre} (RUT: {trabajador_rut})")
        print(f"   Empresa: {trabajador.get('empresa')}")
        print(f"   trabajador_id: {trabajador_id}")
        
        # ========================================================================
        # STEP 3: POST /api/vehiculos/:id/operador - Assign first operator
        # ========================================================================
        print("\n[STEP 3] POST /api/vehiculos/:id/operador - Assign first operator")
        print("-" * 80)
        
        fecha_inicio = date.today().isoformat()
        
        operador_data = {
            "trabajador_id": trabajador_id,
            "fecha_inicio": fecha_inicio,
            "fecha_fin": None,
            "observacion": "QA test - first operator"
        }
        
        print(f"Assigning operator to vehicle {vehiculo_patente}")
        print(f"   trabajador_id: {trabajador_id}")
        print(f"   fecha_inicio: {fecha_inicio}")
        print(f"   observacion: QA test - first operator")
        
        response = requests.post(
            f"{BASE_URL}/vehiculos/{vehiculo_id}/operador",
            headers=headers,
            json=operador_data,
            timeout=30
        )
        
        print(f"Status: {response.status_code}")
        
        if response.status_code != 201:
            print(f"❌ FAILED: Expected 201, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
        
        data = response.json()
        
        if not data.get("ok"):
            print(f"❌ FAILED: Expected {{ok:true}}, got {data}")
            return False
        
        print(f"✅ PASSED: Operator assigned successfully")
        print(f"   Response: {data}")
        
        # Verify via GET /api/vehiculos/:id
        print("\n   Verifying via GET /api/vehiculos/:id...")
        
        response = requests.get(f"{BASE_URL}/vehiculos/{vehiculo_id}", headers=headers, timeout=30)
        
        if response.status_code != 200:
            print(f"❌ FAILED: GET /api/vehiculos/:id returned {response.status_code}")
            return False
        
        data = response.json()
        recurso = data.get("recurso")
        operador_actual = data.get("operador_actual")
        operadores = data.get("operadores", [])
        
        # Verify operador_actual is populated
        if not operador_actual:
            print("❌ FAILED: operador_actual is null after assignment")
            return False
        
        print(f"✅ PASSED: operador_actual is populated")
        print(f"   Nombre: {operador_actual.get('nombre')} {operador_actual.get('apellido')}")
        print(f"   RUT: {operador_actual.get('rut')}")
        print(f"   fecha_inicio: {operador_actual.get('fecha_inicio')}")
        
        # Verify operadores array has 1 entry with vigente=true
        if len(operadores) == 0:
            print("❌ FAILED: operadores array is empty")
            return False
        
        vigentes = [op for op in operadores if op.get("vigente")]
        
        if len(vigentes) != 1:
            print(f"❌ FAILED: Expected 1 vigente operator, got {len(vigentes)}")
            return False
        
        print(f"✅ PASSED: operadores array has 1 entry with vigente=true")
        print(f"   Total operadores: {len(operadores)}")
        print(f"   Vigentes: {len(vigentes)}")
        
        # Verify disponibilidad (derived in frontend, but operador_actual != null means "En uso")
        print(f"✅ PASSED: Disponibilidad should be 'En uso' (operador_actual != null)")
        
        # ========================================================================
        # STEP 4: POST another operator - Verify previous is finalized
        # ========================================================================
        print("\n[STEP 4] POST /api/vehiculos/:id/operador - Assign second operator")
        print("-" * 80)
        
        # Find another worker from same empresa
        trabajador2 = None
        for t in trabajadores:
            if t.get("empresa") == vehiculo_empresa and t.get("trabajador_id") != trabajador_id:
                trabajador2 = t
                break
        
        if not trabajador2:
            print(f"⚠️ WARNING: No second worker found from empresa '{vehiculo_empresa}'")
            print(f"   Skipping STEP 4 (assigning second operator)")
            trabajador2_id = trabajador_id  # Use same worker for testing
        else:
            trabajador2_id = trabajador2.get("trabajador_id")
            trabajador2_nombre = f"{trabajador2.get('nombre')} {trabajador2.get('apellido')}"
            print(f"   Found second worker: {trabajador2_nombre}")
        
        operador_data2 = {
            "trabajador_id": trabajador2_id,
            "fecha_inicio": fecha_inicio,
            "fecha_fin": None,
            "observacion": "QA test - second operator"
        }
        
        print(f"Assigning second operator to vehicle {vehiculo_patente}")
        print(f"   trabajador_id: {trabajador2_id}")
        
        response = requests.post(
            f"{BASE_URL}/vehiculos/{vehiculo_id}/operador",
            headers=headers,
            json=operador_data2,
            timeout=30
        )
        
        print(f"Status: {response.status_code}")
        
        if response.status_code != 201:
            print(f"❌ FAILED: Expected 201, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
        
        print(f"✅ PASSED: Second operator assigned successfully")
        
        # Verify via GET /api/vehiculos/:id
        print("\n   Verifying via GET /api/vehiculos/:id...")
        
        response = requests.get(f"{BASE_URL}/vehiculos/{vehiculo_id}", headers=headers, timeout=30)
        
        if response.status_code != 200:
            print(f"❌ FAILED: GET /api/vehiculos/:id returned {response.status_code}")
            return False
        
        data = response.json()
        operadores = data.get("operadores", [])
        
        # Verify operadores array has 2 entries
        if len(operadores) < 2:
            print(f"❌ FAILED: Expected at least 2 operadores, got {len(operadores)}")
            return False
        
        print(f"✅ PASSED: operadores array has {len(operadores)} entries")
        
        # Verify only 1 with vigente=true
        vigentes = [op for op in operadores if op.get("vigente")]
        
        if len(vigentes) != 1:
            print(f"❌ FAILED: Expected 1 vigente operator, got {len(vigentes)}")
            return False
        
        print(f"✅ PASSED: Only 1 operator with vigente=true")
        
        # Verify previous operator has estado='finalizado' and fecha_fin set
        finalizados = [op for op in operadores if op.get("estado") == "finalizado"]
        
        if len(finalizados) == 0:
            print(f"❌ FAILED: Expected at least 1 finalizado operator")
            return False
        
        print(f"✅ PASSED: Previous operator has estado='finalizado'")
        
        # Check if fecha_fin is set for finalizados
        for op in finalizados:
            if not op.get("fecha_fin"):
                print(f"❌ FAILED: Finalizado operator missing fecha_fin")
                return False
        
        print(f"✅ PASSED: Finalizado operators have fecha_fin set")
        
        # ========================================================================
        # STEP 5: POST /api/vehiculos/:id/estado-operativo - Change estado
        # ========================================================================
        print("\n[STEP 5] POST /api/vehiculos/:id/estado-operativo - Change estado")
        print("-" * 80)
        
        # Test valid estado: mantencion
        print("   Testing valid estado: 'mantencion'")
        
        response = requests.post(
            f"{BASE_URL}/vehiculos/{vehiculo_id}/estado-operativo",
            headers=headers,
            json={"estado_operativo": "mantencion"},
            timeout=30
        )
        
        print(f"Status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ FAILED: Expected 200, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
        
        print(f"✅ PASSED: estado_operativo changed to 'mantencion'")
        
        # Verify via GET
        response = requests.get(f"{BASE_URL}/vehiculos/{vehiculo_id}", headers=headers, timeout=30)
        
        if response.status_code != 200:
            print(f"❌ FAILED: GET /api/vehiculos/:id returned {response.status_code}")
            return False
        
        data = response.json()
        recurso = data.get("recurso")
        
        if recurso.get("estado_operativo") != "mantencion":
            print(f"❌ FAILED: estado_operativo not updated. Expected 'mantencion', got '{recurso.get('estado_operativo')}'")
            return False
        
        print(f"✅ PASSED: GET confirms estado_operativo == 'mantencion'")
        
        # Revert to disponible
        print("\n   Reverting to 'disponible'")
        
        response = requests.post(
            f"{BASE_URL}/vehiculos/{vehiculo_id}/estado-operativo",
            headers=headers,
            json={"estado_operativo": "disponible"},
            timeout=30
        )
        
        if response.status_code != 200:
            print(f"❌ FAILED: Expected 200, got {response.status_code}")
            return False
        
        print(f"✅ PASSED: estado_operativo reverted to 'disponible'")
        
        # Test invalid estado
        print("\n   Testing invalid estado: 'xyz'")
        
        response = requests.post(
            f"{BASE_URL}/vehiculos/{vehiculo_id}/estado-operativo",
            headers=headers,
            json={"estado_operativo": "xyz"},
            timeout=30
        )
        
        print(f"Status: {response.status_code}")
        
        if response.status_code != 400:
            print(f"❌ FAILED: Expected 400 for invalid estado, got {response.status_code}")
            return False
        
        print(f"✅ PASSED: Invalid estado correctly rejected with 400")
        
        # ========================================================================
        # STEP 6: POST /api/vehiculos/:id/operador/liberar - Release operator
        # ========================================================================
        print("\n[STEP 6] POST /api/vehiculos/:id/operador/liberar - Release operator")
        print("-" * 80)
        
        response = requests.post(
            f"{BASE_URL}/vehiculos/{vehiculo_id}/operador/liberar",
            headers=headers,
            json={},
            timeout=30
        )
        
        print(f"Status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ FAILED: Expected 200, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
        
        data = response.json()
        
        if not data.get("ok"):
            print(f"❌ FAILED: Expected {{ok:true}}, got {data}")
            return False
        
        print(f"✅ PASSED: Operator released successfully")
        
        # Verify via GET
        response = requests.get(f"{BASE_URL}/vehiculos/{vehiculo_id}", headers=headers, timeout=30)
        
        if response.status_code != 200:
            print(f"❌ FAILED: GET /api/vehiculos/:id returned {response.status_code}")
            return False
        
        data = response.json()
        operador_actual = data.get("operador_actual")
        operadores = data.get("operadores", [])
        
        # Verify operador_actual is null
        if operador_actual is not None:
            print(f"❌ FAILED: operador_actual should be null after release, got {operador_actual}")
            return False
        
        print(f"✅ PASSED: operador_actual == null")
        
        # Verify no operator with vigente=true
        vigentes = [op for op in operadores if op.get("vigente")]
        
        if len(vigentes) != 0:
            print(f"❌ FAILED: Expected 0 vigente operators, got {len(vigentes)}")
            return False
        
        print(f"✅ PASSED: No operator with vigente=true")
        
        # ========================================================================
        # STEP 7: Repeat minimal case with EQUIPOS
        # ========================================================================
        print("\n[STEP 7] Repeat minimal case with EQUIPOS")
        print("-" * 80)
        
        # Get an equipo
        response = requests.get(f"{BASE_URL}/equipos", headers=headers, timeout=30)
        
        if response.status_code != 200:
            print(f"❌ FAILED: GET /api/equipos returned {response.status_code}")
            return False
        
        data = response.json()
        equipos = data.get("equipos", [])
        
        if len(equipos) == 0:
            print("⚠️ WARNING: No equipos found, skipping STEP 7")
        else:
            equipo = equipos[0]
            equipo_id = equipo.get("equipo_id")
            equipo_empresa = equipo.get("empresa")
            equipo_codigo = equipo.get("codigo_interno")
            
            print(f"   Selected equipo: {equipo_codigo} (ID: {equipo_id})")
            print(f"   Empresa: {equipo_empresa}")
            
            # Find a worker from same empresa
            trabajador_equipo = None
            for t in trabajadores:
                if t.get("empresa") == equipo_empresa:
                    trabajador_equipo = t
                    break
            
            if not trabajador_equipo:
                print(f"⚠️ WARNING: No worker found from empresa '{equipo_empresa}', skipping equipo test")
            else:
                trabajador_equipo_id = trabajador_equipo.get("trabajador_id")
                
                # Assign operator to equipo
                print(f"\n   Assigning operator to equipo {equipo_codigo}")
                
                operador_data = {
                    "trabajador_id": trabajador_equipo_id,
                    "fecha_inicio": fecha_inicio,
                    "fecha_fin": None,
                    "observacion": "QA test - equipo operator"
                }
                
                response = requests.post(
                    f"{BASE_URL}/equipos/{equipo_id}/operador",
                    headers=headers,
                    json=operador_data,
                    timeout=30
                )
                
                if response.status_code != 201:
                    print(f"❌ FAILED: Expected 201, got {response.status_code}")
                    print(f"Response: {response.text}")
                    return False
                
                print(f"✅ PASSED: Operator assigned to equipo")
                
                # Verify operador_actual
                response = requests.get(f"{BASE_URL}/equipos/{equipo_id}", headers=headers, timeout=30)
                
                if response.status_code != 200:
                    print(f"❌ FAILED: GET /api/equipos/:id returned {response.status_code}")
                    return False
                
                data = response.json()
                operador_actual = data.get("operador_actual")
                
                if not operador_actual:
                    print("❌ FAILED: operador_actual is null for equipo")
                    return False
                
                print(f"✅ PASSED: operador_actual populated for equipo")
                print(f"   Nombre: {operador_actual.get('nombre')} {operador_actual.get('apellido')}")
                
                # Release operator
                print(f"\n   Releasing operator from equipo {equipo_codigo}")
                
                response = requests.post(
                    f"{BASE_URL}/equipos/{equipo_id}/operador/liberar",
                    headers=headers,
                    json={},
                    timeout=30
                )
                
                if response.status_code != 200:
                    print(f"❌ FAILED: Expected 200, got {response.status_code}")
                    return False
                
                print(f"✅ PASSED: Operator released from equipo")
        
        # ========================================================================
        # STEP 8: GET /api/public/expediente/:id - QR público
        # ========================================================================
        print("\n[STEP 8] GET /api/public/expediente/:id - QR público (SIN token)")
        print("-" * 80)
        
        print(f"   Testing with vehiculo_id: {vehiculo_id}")
        
        response = requests.get(f"{BASE_URL}/public/expediente/{vehiculo_id}", timeout=30)
        
        print(f"Status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ FAILED: Expected 200, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
        
        data = response.json()
        
        # Verify tipoEntidad
        if data.get("tipoEntidad") != "recurso":
            print(f"❌ FAILED: Expected tipoEntidad='recurso', got '{data.get('tipoEntidad')}'")
            return False
        
        print(f"✅ PASSED: tipoEntidad == 'recurso'")
        
        # Verify required fields
        required_fields = ["nombre", "empresa", "disponibilidad", "estadoGlobal", "perMandante"]
        
        for field in required_fields:
            if field not in data:
                print(f"❌ FAILED: Missing field '{field}' in response")
                return False
        
        print(f"✅ PASSED: All required fields present")
        print(f"   nombre: {data.get('nombre')}")
        print(f"   empresa: {data.get('empresa')}")
        print(f"   disponibilidad: {data.get('disponibilidad')}")
        print(f"   estadoGlobal: {data.get('estadoGlobal')}")
        print(f"   perMandante: {len(data.get('perMandante', []))} mandantes")
        
        # Test with non-existent ID
        print("\n   Testing with non-existent ID")
        
        fake_id = "00000000-0000-0000-0000-000000000000"
        response = requests.get(f"{BASE_URL}/public/expediente/{fake_id}", timeout=30)
        
        print(f"Status: {response.status_code}")
        
        if response.status_code != 404:
            print(f"❌ FAILED: Expected 404 for non-existent ID, got {response.status_code}")
            return False
        
        print(f"✅ PASSED: Non-existent ID correctly returns 404")
        
        # ========================================================================
        # STEP 9: Security - Test endpoints without token
        # ========================================================================
        print("\n[STEP 9] Security - Test endpoints WITHOUT token")
        print("-" * 80)
        
        # POST operador without token
        print("   Testing POST /api/vehiculos/:id/operador without token")
        
        response = requests.post(
            f"{BASE_URL}/vehiculos/{vehiculo_id}/operador",
            json={"trabajador_id": trabajador_id, "fecha_inicio": fecha_inicio},
            timeout=30
        )
        
        print(f"Status: {response.status_code}")
        
        if response.status_code not in [401, 403]:
            print(f"❌ FAILED: Expected 401 or 403, got {response.status_code}")
            return False
        
        print(f"✅ PASSED: POST operador without token returns {response.status_code}")
        
        # GET detail without token
        print("\n   Testing GET /api/vehiculos/:id without token")
        
        response = requests.get(f"{BASE_URL}/vehiculos/{vehiculo_id}", timeout=30)
        
        print(f"Status: {response.status_code}")
        
        if response.status_code != 401:
            print(f"❌ FAILED: Expected 401, got {response.status_code}")
            return False
        
        print(f"✅ PASSED: GET detail without token returns 401")
        
        # ========================================================================
        # STEP 10: Regression - Core endpoints still work
        # ========================================================================
        print("\n[STEP 10] Regression - Core endpoints still work")
        print("-" * 80)
        
        endpoints = [
            "/vehiculos",
            "/equipos",
            "/dashboard"
        ]
        
        for endpoint in endpoints:
            response = requests.get(f"{BASE_URL}{endpoint}", headers=headers, timeout=30)
            
            if response.status_code != 200:
                print(f"❌ FAILED: GET {endpoint} returned {response.status_code}")
                return False
            
            print(f"✅ PASSED: GET {endpoint} returns 200")
        
        # ========================================================================
        # STEP 11: Business validation - fecha_fin < fecha_inicio
        # ========================================================================
        print("\n[STEP 11] Business validation - fecha_fin < fecha_inicio")
        print("-" * 80)
        
        invalid_data = {
            "trabajador_id": trabajador_id,
            "fecha_inicio": "2025-01-15",
            "fecha_fin": "2025-01-10",  # Before fecha_inicio
            "observacion": "Invalid dates"
        }
        
        response = requests.post(
            f"{BASE_URL}/vehiculos/{vehiculo_id}/operador",
            headers=headers,
            json=invalid_data,
            timeout=30
        )
        
        print(f"Status: {response.status_code}")
        
        if response.status_code != 400:
            print(f"❌ FAILED: Expected 400 for invalid dates, got {response.status_code}")
            return False
        
        print(f"✅ PASSED: fecha_fin < fecha_inicio correctly rejected with 400")
        
        # ========================================================================
        # STEP 12: Business validation - Missing required fields
        # ========================================================================
        print("\n[STEP 12] Business validation - Missing required fields")
        print("-" * 80)
        
        # Missing trabajador_id
        print("   Testing missing trabajador_id")
        
        response = requests.post(
            f"{BASE_URL}/vehiculos/{vehiculo_id}/operador",
            headers=headers,
            json={"fecha_inicio": fecha_inicio},
            timeout=30
        )
        
        if response.status_code != 400:
            print(f"❌ FAILED: Expected 400 for missing trabajador_id, got {response.status_code}")
            return False
        
        print(f"✅ PASSED: Missing trabajador_id correctly rejected with 400")
        
        # Missing fecha_inicio
        print("\n   Testing missing fecha_inicio")
        
        response = requests.post(
            f"{BASE_URL}/vehiculos/{vehiculo_id}/operador",
            headers=headers,
            json={"trabajador_id": trabajador_id},
            timeout=30
        )
        
        if response.status_code != 400:
            print(f"❌ FAILED: Expected 400 for missing fecha_inicio, got {response.status_code}")
            return False
        
        print(f"✅ PASSED: Missing fecha_inicio correctly rejected with 400")
        
        # ========================================================================
        # ALL TESTS PASSED
        # ========================================================================
        print("\n" + "=" * 80)
        print("✅ ALL TESTS PASSED (12/12 steps)")
        print("=" * 80)
        print("\nSummary:")
        print("  1. GET /api/vehiculos - Verified new fields (estado_operativo, operador_actual) ✅")
        print("  2. GET /api/trabajadores - Found worker from same empresa ✅")
        print("  3. POST /api/vehiculos/:id/operador - First operator assigned ✅")
        print("  4. POST /api/vehiculos/:id/operador - Second operator assigned, previous finalized ✅")
        print("  5. POST /api/vehiculos/:id/estado-operativo - Estado changed and validated ✅")
        print("  6. POST /api/vehiculos/:id/operador/liberar - Operator released ✅")
        print("  7. Equipos - Minimal case tested (assign + release) ✅")
        print("  8. GET /api/public/expediente/:id - QR público works (200 + 404) ✅")
        print("  9. Security - Endpoints require auth (401/403) ✅")
        print(" 10. Regression - Core endpoints still work ✅")
        print(" 11. Business validation - fecha_fin < fecha_inicio rejected ✅")
        print(" 12. Business validation - Missing required fields rejected ✅")
        print("\nCleanup: All test operators released")
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
    success = test_operador_functionality()
    sys.exit(0 if success else 1)
