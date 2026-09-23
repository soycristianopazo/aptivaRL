#!/usr/bin/env python3
"""
Backend API Testing Script for Aptiva RL
Tests the NEW DELETE /api/trabajadores/asignaciones/:asignacion_id endpoint
"""

import requests
import json
import sys
from datetime import datetime

# Base URL from .env
BASE_URL = "https://aptiva-db.preview.emergentagent.com/api"

# Test credentials
ADMIN_EMAIL = "admin@aptivarl.com"
ADMIN_PASSWORD = "Aptiva2025!"
RRHH_EMAIL = "crivera@rioloa.cl"
RRHH_PASSWORD = "Aptiva2025!"

# Color codes for output
GREEN = '\033[92m'
RED = '\033[91m'
YELLOW = '\033[93m'
BLUE = '\033[94m'
RESET = '\033[0m'

def log(message, color=RESET):
    """Print colored log message"""
    print(f"{color}{message}{RESET}")

def login(email, password):
    """Login and return token"""
    try:
        log(f"\n🔐 Logging in as {email}...", BLUE)
        response = requests.post(
            f"{BASE_URL}/auth/login",
            json={"email": email, "password": password},
            timeout=30
        )
        if response.status_code == 200:
            data = response.json()
            token = data.get('token')
            # Get full profile from /api/me to get mandante_ids
            headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
            me_response = requests.get(f"{BASE_URL}/me", headers=headers, timeout=30)
            if me_response.status_code == 200:
                profile = me_response.json().get('profile', {})
            else:
                profile = data.get('profile', {})
            log(f"✅ Login successful - Role: {profile.get('role_codigo', 'N/A')}", GREEN)
            if 'mandante_ids' in profile:
                log(f"   Mandantes in scope: {len(profile.get('mandante_ids', []))}", BLUE)
            return token, profile
        else:
            log(f"❌ Login failed: {response.status_code} - {response.text}", RED)
            return None, None
    except Exception as e:
        log(f"❌ Login error: {str(e)}", RED)
        return None, None

def get_headers(token):
    """Get headers with authorization"""
    return {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }

def generate_rut():
    """Generate a unique Chilean RUT for testing"""
    import random
    base = random.randint(20000000, 25000000)
    # Calculate verification digit
    reversed_digits = str(base)[::-1]
    suma = sum((int(d) * ((i % 6) + 2)) for i, d in enumerate(reversed_digits))
    dv = 11 - (suma % 11)
    if dv == 11:
        dv = '0'
    elif dv == 10:
        dv = 'K'
    else:
        dv = str(dv)
    return f"{base}-{dv}"

def test_delete_asignacion_endpoint():
    """
    Test the NEW DELETE /api/trabajadores/asignaciones/:asignacion_id endpoint
    """
    log("\n" + "="*80, BLUE)
    log("TESTING: DELETE /api/trabajadores/asignaciones/:asignacion_id", BLUE)
    log("="*80 + "\n", BLUE)
    
    # Step 1: Login as admin
    log("\n📋 STEP 1: Login as admin", YELLOW)
    admin_token, admin_profile = login(ADMIN_EMAIL, ADMIN_PASSWORD)
    if not admin_token:
        log("❌ CRITICAL: Admin login failed. Cannot proceed.", RED)
        return False
    
    # Step 2: Login as RR.HH. user
    log("\n📋 STEP 2: Login as RR.HH. user (crivera)", YELLOW)
    rrhh_token, rrhh_profile = login(RRHH_EMAIL, RRHH_PASSWORD)
    if not rrhh_token:
        log("❌ CRITICAL: RR.HH. login failed. Cannot proceed.", RED)
        return False
    
    rrhh_mandantes = rrhh_profile.get('mandante_ids', [])
    log(f"   RR.HH. user has {len(rrhh_mandantes)} mandantes in scope", BLUE)
    
    # Step 3: Get empresas and select one
    log("\n📋 STEP 3: Get empresas and select one", YELLOW)
    try:
        response = requests.get(f"{BASE_URL}/empresas", headers=get_headers(admin_token), timeout=30)
        if response.status_code != 200:
            log(f"❌ GET /api/empresas failed: {response.status_code}", RED)
            return False
        empresas_data = response.json()
        # Handle both dict with 'empresas' key and direct list
        if isinstance(empresas_data, dict):
            empresas = empresas_data.get('empresas', [])
        else:
            empresas = empresas_data
        if not empresas:
            log("❌ No empresas found", RED)
            return False
        
        # Select empresa with contratos
        selected_empresa = None
        for empresa in empresas:
            if empresa.get('contratos_count', 0) > 0:
                selected_empresa = empresa
                break
        
        if not selected_empresa:
            selected_empresa = empresas[0]
        
        empresa_id = selected_empresa['empresa_id']
        empresa_nombre = selected_empresa['razon_social']
        log(f"✅ Selected empresa: {empresa_nombre} (ID: {empresa_id})", GREEN)
    except Exception as e:
        log(f"❌ Error getting empresas: {str(e)}", RED)
        return False
    
    # Step 4: Get contratos from different mandantes
    log("\n📋 STEP 4: Get contratos from 2 different mandantes", YELLOW)
    try:
        response = requests.get(f"{BASE_URL}/contratos", headers=get_headers(admin_token), timeout=30)
        if response.status_code != 200:
            log(f"❌ GET /api/contratos failed: {response.status_code}", RED)
            return False
        contratos_data = response.json()
        # Handle both dict with 'contratos' key and direct list
        if isinstance(contratos_data, dict):
            contratos = contratos_data.get('contratos', [])
        else:
            contratos = contratos_data
        
        # Filter contratos by empresa and find 2 from different mandantes
        empresa_contratos = [c for c in contratos if c.get('empresa_id') == empresa_id]
        if len(empresa_contratos) < 2:
            log(f"⚠️  Only {len(empresa_contratos)} contratos found for empresa. Need at least 2.", YELLOW)
            # Try to find contratos from any empresa with multiple mandantes
            mandante_map = {}
            for c in contratos:
                mid = c.get('mandante_id')
                if mid not in mandante_map:
                    mandante_map[mid] = []
                mandante_map[mid].append(c)
            
            # Find 2 contratos from different mandantes
            selected_contratos = []
            for mid, contracts in mandante_map.items():
                if len(selected_contratos) < 2 and contracts:
                    selected_contratos.append(contracts[0])
            
            if len(selected_contratos) < 2:
                log("❌ Cannot find 2 contratos from different mandantes", RED)
                return False
            
            contrato1 = selected_contratos[0]
            contrato2 = selected_contratos[1]
            # Update empresa_id to match first contrato
            empresa_id = contrato1['empresa_id']
        else:
            # Find 2 contratos from different mandantes
            mandante_ids = list(set([c['mandante_id'] for c in empresa_contratos]))
            if len(mandante_ids) < 2:
                log(f"⚠️  All contratos belong to same mandante. Using first 2 contratos.", YELLOW)
                contrato1 = empresa_contratos[0]
                contrato2 = empresa_contratos[1] if len(empresa_contratos) > 1 else empresa_contratos[0]
            else:
                contrato1 = next(c for c in empresa_contratos if c['mandante_id'] == mandante_ids[0])
                contrato2 = next(c for c in empresa_contratos if c['mandante_id'] == mandante_ids[1])
        
        contrato1_id = contrato1['contrato_id']
        contrato1_mandante = contrato1['mandante_id']
        contrato1_nombre = contrato1.get('numero_oc', 'N/A')
        
        contrato2_id = contrato2['contrato_id']
        contrato2_mandante = contrato2['mandante_id']
        contrato2_nombre = contrato2.get('numero_oc', 'N/A')
        
        log(f"✅ Contrato 1: {contrato1_nombre} (Mandante: {contrato1_mandante})", GREEN)
        log(f"✅ Contrato 2: {contrato2_nombre} (Mandante: {contrato2_mandante})", GREEN)
        
        # Check if RR.HH. user has access to these mandantes
        rrhh_has_mandante1 = contrato1_mandante in rrhh_mandantes
        rrhh_has_mandante2 = contrato2_mandante in rrhh_mandantes
        log(f"   RR.HH. has access to mandante1: {rrhh_has_mandante1}", BLUE)
        log(f"   RR.HH. has access to mandante2: {rrhh_has_mandante2}", BLUE)
        
    except Exception as e:
        log(f"❌ Error getting contratos: {str(e)}", RED)
        return False
    
    # Step 5: Create a trabajador
    log("\n📋 STEP 5: Create a trabajador", YELLOW)
    test_rut = generate_rut()
    trabajador_data = {
        "empresa_id": empresa_id,
        "rut": test_rut,
        "nombre": "Test",
        "apellido": "Asignacion Delete",
        "cargo": "QA Tester",
        "es_spot": False
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/trabajadores",
            headers=get_headers(admin_token),
            json=trabajador_data,
            timeout=30
        )
        if response.status_code != 201:
            log(f"❌ POST /api/trabajadores failed: {response.status_code} - {response.text}", RED)
            return False
        
        trabajador_response = response.json()
        # Handle both direct object and nested 'trabajador' key
        if 'trabajador' in trabajador_response:
            trabajador = trabajador_response['trabajador']
        else:
            trabajador = trabajador_response
        trabajador_id = trabajador['trabajador_id']
        log(f"✅ Trabajador created: {trabajador_data['nombre']} {trabajador_data['apellido']} (RUT: {test_rut})", GREEN)
        log(f"   Trabajador ID: {trabajador_id}", BLUE)
    except Exception as e:
        log(f"❌ Error creating trabajador: {str(e)}", RED)
        return False
    
    # Step 6: Assign trabajador to contrato 1
    log("\n📋 STEP 6: Assign trabajador to contrato 1", YELLOW)
    try:
        response = requests.post(
            f"{BASE_URL}/trabajadores/asignar",
            headers=get_headers(admin_token),
            json={"trabajador_id": trabajador_id, "contrato_id": contrato1_id},
            timeout=30
        )
        if response.status_code != 201:
            log(f"❌ POST /api/trabajadores/asignar failed: {response.status_code} - {response.text}", RED)
            # Cleanup
            requests.delete(f"{BASE_URL}/trabajadores/{trabajador_id}", headers=get_headers(admin_token), timeout=30)
            return False
        
        asignacion1 = response.json().get('asignacion', {})
        asignacion1_id = asignacion1.get('asignacion_id')
        log(f"✅ Assignment 1 created: {asignacion1_id}", GREEN)
        log(f"   Contrato: {contrato1_nombre}, Mandante: {contrato1_mandante}", BLUE)
    except Exception as e:
        log(f"❌ Error assigning to contrato 1: {str(e)}", RED)
        # Cleanup
        requests.delete(f"{BASE_URL}/trabajadores/{trabajador_id}", headers=get_headers(admin_token), timeout=30)
        return False
    
    # Step 7: Assign trabajador to contrato 2
    log("\n📋 STEP 7: Assign trabajador to contrato 2", YELLOW)
    try:
        response = requests.post(
            f"{BASE_URL}/trabajadores/asignar",
            headers=get_headers(admin_token),
            json={"trabajador_id": trabajador_id, "contrato_id": contrato2_id},
            timeout=30
        )
        if response.status_code != 201:
            log(f"❌ POST /api/trabajadores/asignar failed: {response.status_code} - {response.text}", RED)
            # Cleanup
            requests.delete(f"{BASE_URL}/trabajadores/{trabajador_id}", headers=get_headers(admin_token), timeout=30)
            return False
        
        asignacion2 = response.json().get('asignacion', {})
        asignacion2_id = asignacion2.get('asignacion_id')
        log(f"✅ Assignment 2 created: {asignacion2_id}", GREEN)
        log(f"   Contrato: {contrato2_nombre}, Mandante: {contrato2_mandante}", BLUE)
    except Exception as e:
        log(f"❌ Error assigning to contrato 2: {str(e)}", RED)
        # Cleanup
        requests.delete(f"{BASE_URL}/trabajadores/{trabajador_id}", headers=get_headers(admin_token), timeout=30)
        return False
    
    # Step 8: DELETE assignment 1 as admin
    log("\n📋 STEP 8: DELETE assignment 1 as admin (NEW ENDPOINT)", YELLOW)
    try:
        response = requests.delete(
            f"{BASE_URL}/trabajadores/asignaciones/{asignacion1_id}",
            headers=get_headers(admin_token),
            timeout=30
        )
        if response.status_code != 200:
            log(f"❌ DELETE /api/trabajadores/asignaciones/{asignacion1_id} failed: {response.status_code} - {response.text}", RED)
            # Cleanup
            requests.delete(f"{BASE_URL}/trabajadores/{trabajador_id}", headers=get_headers(admin_token), timeout=30)
            return False
        
        result = response.json()
        log(f"✅ DELETE assignment 1 successful: {result}", GREEN)
    except Exception as e:
        log(f"❌ Error deleting assignment 1: {str(e)}", RED)
        # Cleanup
        requests.delete(f"{BASE_URL}/trabajadores/{trabajador_id}", headers=get_headers(admin_token), timeout=30)
        return False
    
    # Step 9: Verify assignment 1 is inactivo and assignment 2 is still activo
    log("\n📋 STEP 9: Verify assignment states", YELLOW)
    try:
        response = requests.get(
            f"{BASE_URL}/trabajadores/{trabajador_id}",
            headers=get_headers(admin_token),
            timeout=30
        )
        if response.status_code != 200:
            log(f"❌ GET /api/trabajadores/{trabajador_id} failed: {response.status_code}", RED)
            # Cleanup
            requests.delete(f"{BASE_URL}/trabajadores/{trabajador_id}", headers=get_headers(admin_token), timeout=30)
            return False
        
        trabajador_detail = response.json()
        asignaciones = trabajador_detail.get('asignaciones', [])
        
        asig1 = next((a for a in asignaciones if a['asignacion_id'] == asignacion1_id), None)
        asig2 = next((a for a in asignaciones if a['asignacion_id'] == asignacion2_id), None)
        
        if not asig1:
            log(f"❌ Assignment 1 not found in trabajador detail", RED)
            # Cleanup
            requests.delete(f"{BASE_URL}/trabajadores/{trabajador_id}", headers=get_headers(admin_token), timeout=30)
            return False
        
        if not asig2:
            log(f"❌ Assignment 2 not found in trabajador detail", RED)
            # Cleanup
            requests.delete(f"{BASE_URL}/trabajadores/{trabajador_id}", headers=get_headers(admin_token), timeout=30)
            return False
        
        asig1_estado = asig1.get('estado')
        asig2_estado = asig2.get('estado')
        asig1_fecha_desasignacion = asig1.get('fecha_desasignacion')
        
        log(f"   Assignment 1 estado: {asig1_estado} (expected: inactivo)", BLUE)
        log(f"   Assignment 1 fecha_desasignacion: {asig1_fecha_desasignacion}", BLUE)
        log(f"   Assignment 2 estado: {asig2_estado} (expected: activo)", BLUE)
        
        if asig1_estado != 'inactivo':
            log(f"❌ Assignment 1 estado is '{asig1_estado}', expected 'inactivo'", RED)
            # Cleanup
            requests.delete(f"{BASE_URL}/trabajadores/{trabajador_id}", headers=get_headers(admin_token), timeout=30)
            return False
        
        if not asig1_fecha_desasignacion:
            log(f"❌ Assignment 1 fecha_desasignacion is null, expected timestamp", RED)
            # Cleanup
            requests.delete(f"{BASE_URL}/trabajadores/{trabajador_id}", headers=get_headers(admin_token), timeout=30)
            return False
        
        if asig2_estado != 'activo':
            log(f"❌ Assignment 2 estado is '{asig2_estado}', expected 'activo'", RED)
            # Cleanup
            requests.delete(f"{BASE_URL}/trabajadores/{trabajador_id}", headers=get_headers(admin_token), timeout=30)
            return False
        
        log(f"✅ Assignment states verified correctly", GREEN)
        
        # Verify NO desvinculacion was created for assignment 1
        log("\n   Verifying NO desvinculacion was created...", BLUE)
        desvinculacion_id = asig1.get('desvinculacion_id')
        if desvinculacion_id:
            log(f"❌ Assignment 1 has desvinculacion_id: {desvinculacion_id} (should be null)", RED)
            # Cleanup
            requests.delete(f"{BASE_URL}/trabajadores/{trabajador_id}", headers=get_headers(admin_token), timeout=30)
            return False
        
        log(f"✅ Confirmed: NO desvinculacion created (desvinculacion_id is null)", GREEN)
        
    except Exception as e:
        log(f"❌ Error verifying assignments: {str(e)}", RED)
        # Cleanup
        requests.delete(f"{BASE_URL}/trabajadores/{trabajador_id}", headers=get_headers(admin_token), timeout=30)
        return False
    
    # Step 10: Test RR.HH. permissions
    log("\n📋 STEP 10: Test RR.HH. permissions", YELLOW)
    
    # Determine which assignment RR.HH. can delete (in scope)
    if rrhh_has_mandante2:
        # RR.HH. can delete assignment 2 (in scope)
        log(f"   Testing DELETE assignment 2 as RR.HH. (in scope)...", BLUE)
        try:
            response = requests.delete(
                f"{BASE_URL}/trabajadores/asignaciones/{asignacion2_id}",
                headers=get_headers(rrhh_token),
                timeout=30
            )
            if response.status_code != 200:
                log(f"❌ DELETE as RR.HH. (in scope) failed: {response.status_code} - {response.text}", RED)
                # Cleanup
                requests.delete(f"{BASE_URL}/trabajadores/{trabajador_id}", headers=get_headers(admin_token), timeout=30)
                return False
            
            log(f"✅ DELETE as RR.HH. (in scope) successful: 200", GREEN)
        except Exception as e:
            log(f"❌ Error deleting as RR.HH.: {str(e)}", RED)
            # Cleanup
            requests.delete(f"{BASE_URL}/trabajadores/{trabajador_id}", headers=get_headers(admin_token), timeout=30)
            return False
    else:
        log(f"   ⚠️  RR.HH. user does not have access to mandante2. Skipping in-scope test.", YELLOW)
    
    # Test out-of-scope (if RR.HH. doesn't have access to mandante1)
    if not rrhh_has_mandante1:
        log(f"\n   Testing DELETE assignment 1 as RR.HH. (out of scope)...", BLUE)
        try:
            response = requests.delete(
                f"{BASE_URL}/trabajadores/asignaciones/{asignacion1_id}",
                headers=get_headers(rrhh_token),
                timeout=30
            )
            if response.status_code != 403:
                log(f"❌ DELETE as RR.HH. (out of scope) returned {response.status_code}, expected 403", RED)
                # Cleanup
                requests.delete(f"{BASE_URL}/trabajadores/{trabajador_id}", headers=get_headers(admin_token), timeout=30)
                return False
            
            log(f"✅ DELETE as RR.HH. (out of scope) correctly denied: 403", GREEN)
        except Exception as e:
            log(f"❌ Error testing out-of-scope: {str(e)}", RED)
            # Cleanup
            requests.delete(f"{BASE_URL}/trabajadores/{trabajador_id}", headers=get_headers(admin_token), timeout=30)
            return False
    else:
        log(f"   ⚠️  RR.HH. user has access to mandante1. Cannot test out-of-scope scenario.", YELLOW)
    
    # Step 11: Test DELETE already inactive assignment
    log("\n📋 STEP 11: Test DELETE already inactive assignment", YELLOW)
    try:
        response = requests.delete(
            f"{BASE_URL}/trabajadores/asignaciones/{asignacion1_id}",
            headers=get_headers(admin_token),
            timeout=30
        )
        if response.status_code != 400:
            log(f"❌ DELETE inactive assignment returned {response.status_code}, expected 400", RED)
            # Cleanup
            requests.delete(f"{BASE_URL}/trabajadores/{trabajador_id}", headers=get_headers(admin_token), timeout=30)
            return False
        
        error_msg = response.json().get('error', '')
        log(f"✅ DELETE inactive assignment correctly denied: 400 - {error_msg}", GREEN)
    except Exception as e:
        log(f"❌ Error testing inactive assignment: {str(e)}", RED)
        # Cleanup
        requests.delete(f"{BASE_URL}/trabajadores/{trabajador_id}", headers=get_headers(admin_token), timeout=30)
        return False
    
    # Step 12: Test DELETE non-existent assignment
    log("\n📋 STEP 12: Test DELETE non-existent assignment", YELLOW)
    fake_uuid = "00000000-0000-0000-0000-000000000000"
    try:
        response = requests.delete(
            f"{BASE_URL}/trabajadores/asignaciones/{fake_uuid}",
            headers=get_headers(admin_token),
            timeout=30
        )
        if response.status_code != 404:
            log(f"❌ DELETE non-existent assignment returned {response.status_code}, expected 404", RED)
            # Cleanup
            requests.delete(f"{BASE_URL}/trabajadores/{trabajador_id}", headers=get_headers(admin_token), timeout=30)
            return False
        
        error_msg = response.json().get('error', '')
        log(f"✅ DELETE non-existent assignment correctly denied: 404 - {error_msg}", GREEN)
    except Exception as e:
        log(f"❌ Error testing non-existent assignment: {str(e)}", RED)
        # Cleanup
        requests.delete(f"{BASE_URL}/trabajadores/{trabajador_id}", headers=get_headers(admin_token), timeout=30)
        return False
    
    # Step 13: Verify audit event
    log("\n📋 STEP 13: Verify audit event 'quitar_asignacion'", YELLOW)
    try:
        response = requests.get(
            f"{BASE_URL}/auditoria?accion=quitar_asignacion",
            headers=get_headers(admin_token),
            timeout=30
        )
        if response.status_code != 200:
            log(f"❌ GET /api/auditoria failed: {response.status_code}", RED)
            # Cleanup
            requests.delete(f"{BASE_URL}/trabajadores/{trabajador_id}", headers=get_headers(admin_token), timeout=30)
            return False
        
        audit_data = response.json()
        eventos = audit_data.get('eventos', [])
        
        # Find audit events for our trabajador (entidad_id field)
        quitar_eventos = [e for e in eventos if e.get('accion') == 'quitar_asignacion' and e.get('entidad_id') == trabajador_id]
        
        if not quitar_eventos:
            log(f"❌ No 'quitar_asignacion' audit events found for trabajador {trabajador_id}", RED)
            # Cleanup
            requests.delete(f"{BASE_URL}/trabajadores/{trabajador_id}", headers=get_headers(admin_token), timeout=30)
            return False
        
        log(f"✅ Found {len(quitar_eventos)} 'quitar_asignacion' audit event(s)", GREEN)
        for evento in quitar_eventos[:2]:  # Show first 2
            log(f"   Event: {evento.get('accion')} by {evento.get('usuario')} at {evento.get('created_at')}", BLUE)
            log(f"   Metadata: {evento.get('valores_nuevos')}", BLUE)
    except Exception as e:
        log(f"❌ Error verifying audit: {str(e)}", RED)
        # Cleanup
        requests.delete(f"{BASE_URL}/trabajadores/{trabajador_id}", headers=get_headers(admin_token), timeout=30)
        return False
    
    # Step 14: Regression test - verify POST /api/trabajadores/asignar still works
    log("\n📋 STEP 14: Regression test - POST /api/trabajadores/asignar", YELLOW)
    try:
        # Create a new trabajador for regression test
        test_rut2 = generate_rut()
        trabajador_data2 = {
            "empresa_id": empresa_id,
            "rut": test_rut2,
            "nombre": "Regression",
            "apellido": "Test Asignar",
            "cargo": "QA Tester"
        }
        
        response = requests.post(
            f"{BASE_URL}/trabajadores",
            headers=get_headers(admin_token),
            json=trabajador_data2,
            timeout=30
        )
        if response.status_code != 201:
            log(f"❌ POST /api/trabajadores (regression) failed: {response.status_code}", RED)
            # Cleanup
            requests.delete(f"{BASE_URL}/trabajadores/{trabajador_id}", headers=get_headers(admin_token), timeout=30)
            return False
        
        trabajador2_response = response.json()
        # Handle both direct object and nested 'trabajador' key
        if 'trabajador' in trabajador2_response:
            trabajador2 = trabajador2_response['trabajador']
        else:
            trabajador2 = trabajador2_response
        trabajador2_id = trabajador2['trabajador_id']
        log(f"✅ Regression trabajador created: {trabajador2_id}", GREEN)
        
        # Test POST /api/trabajadores/asignar as admin
        response = requests.post(
            f"{BASE_URL}/trabajadores/asignar",
            headers=get_headers(admin_token),
            json={"trabajador_id": trabajador2_id, "contrato_id": contrato1_id},
            timeout=30
        )
        if response.status_code != 201:
            log(f"❌ POST /api/trabajadores/asignar (admin) failed: {response.status_code} - {response.text}", RED)
            # Cleanup
            requests.delete(f"{BASE_URL}/trabajadores/{trabajador_id}", headers=get_headers(admin_token), timeout=30)
            requests.delete(f"{BASE_URL}/trabajadores/{trabajador2_id}", headers=get_headers(admin_token), timeout=30)
            return False
        
        log(f"✅ POST /api/trabajadores/asignar (admin) successful: 201", GREEN)
        
        # Test POST /api/trabajadores/asignar as RR.HH. (in scope)
        if rrhh_has_mandante2:
            response = requests.post(
                f"{BASE_URL}/trabajadores/asignar",
                headers=get_headers(rrhh_token),
                json={"trabajador_id": trabajador2_id, "contrato_id": contrato2_id},
                timeout=30
            )
            if response.status_code != 201:
                log(f"❌ POST /api/trabajadores/asignar (RR.HH. in scope) failed: {response.status_code} - {response.text}", RED)
                # Cleanup
                requests.delete(f"{BASE_URL}/trabajadores/{trabajador_id}", headers=get_headers(admin_token), timeout=30)
                requests.delete(f"{BASE_URL}/trabajadores/{trabajador2_id}", headers=get_headers(admin_token), timeout=30)
                return False
            
            log(f"✅ POST /api/trabajadores/asignar (RR.HH. in scope) successful: 201", GREEN)
        
        # Test POST /api/trabajadores/asignar as RR.HH. (out of scope)
        if not rrhh_has_mandante1:
            response = requests.post(
                f"{BASE_URL}/trabajadores/asignar",
                headers=get_headers(rrhh_token),
                json={"trabajador_id": trabajador2_id, "contrato_id": contrato1_id},
                timeout=30
            )
            if response.status_code != 403:
                log(f"❌ POST /api/trabajadores/asignar (RR.HH. out of scope) returned {response.status_code}, expected 403", RED)
                # Cleanup
                requests.delete(f"{BASE_URL}/trabajadores/{trabajador_id}", headers=get_headers(admin_token), timeout=30)
                requests.delete(f"{BASE_URL}/trabajadores/{trabajador2_id}", headers=get_headers(admin_token), timeout=30)
                return False
            
            log(f"✅ POST /api/trabajadores/asignar (RR.HH. out of scope) correctly denied: 403", GREEN)
        
        # Cleanup regression trabajador
        response = requests.delete(
            f"{BASE_URL}/trabajadores/{trabajador2_id}",
            headers=get_headers(admin_token),
            timeout=30
        )
        if response.status_code == 200:
            log(f"✅ Regression trabajador deleted", GREEN)
        
    except Exception as e:
        log(f"❌ Error in regression test: {str(e)}", RED)
        # Cleanup
        requests.delete(f"{BASE_URL}/trabajadores/{trabajador_id}", headers=get_headers(admin_token), timeout=30)
        if 'trabajador2_id' in locals():
            requests.delete(f"{BASE_URL}/trabajadores/{trabajador2_id}", headers=get_headers(admin_token), timeout=30)
        return False
    
    # Step 15: Cleanup - delete test trabajador
    log("\n📋 STEP 15: Cleanup - delete test trabajador", YELLOW)
    try:
        response = requests.delete(
            f"{BASE_URL}/trabajadores/{trabajador_id}",
            headers=get_headers(admin_token),
            timeout=30
        )
        if response.status_code != 200:
            log(f"⚠️  DELETE /api/trabajadores/{trabajador_id} returned {response.status_code}", YELLOW)
            log(f"   Response: {response.text}", YELLOW)
        else:
            log(f"✅ Test trabajador deleted successfully (cascade: asignaciones)", GREEN)
    except Exception as e:
        log(f"⚠️  Error deleting test trabajador: {str(e)}", YELLOW)
    
    log("\n" + "="*80, GREEN)
    log("✅ ALL TESTS PASSED - DELETE /api/trabajadores/asignaciones/:asignacion_id", GREEN)
    log("="*80 + "\n", GREEN)
    
    return True

def main():
    """Main test runner"""
    try:
        success = test_delete_asignacion_endpoint()
        if success:
            log("\n🎉 BACKEND TESTING COMPLETE - ALL TESTS PASSED", GREEN)
            sys.exit(0)
        else:
            log("\n❌ BACKEND TESTING FAILED", RED)
            sys.exit(1)
    except Exception as e:
        log(f"\n❌ CRITICAL ERROR: {str(e)}", RED)
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
