#!/usr/bin/env python3
"""
Focused PHASE 5 tests for Aptiva RL - Edit Categorias & Requisitos
"""
import requests
import time

BASE_URL = "https://aptiva-db.preview.emergentagent.com/api"

def test_phase5():
    print("=" * 80)
    print("PHASE 5 FOCUSED TESTS - Edit Categorias & Requisitos")
    print("=" * 80)
    
    # 1. Login as admin
    print("\n1. Login as admin...")
    resp = requests.post(f"{BASE_URL}/auth/login", json={
        "email": "admin@aptivarl.com",
        "password": "Aptiva2025!"
    }, timeout=30)
    assert resp.status_code == 200, f"Login failed: {resp.status_code}"
    admin_token = resp.json()["token"]
    print("✅ Admin login successful")
    
    # 2. Login as mandante
    print("\n2. Login as mandante...")
    resp = requests.post(f"{BASE_URL}/auth/login", json={
        "email": "mandante@aptivarl.com",
        "password": "Aptiva2025!"
    }, timeout=30)
    assert resp.status_code == 200, f"Login failed: {resp.status_code}"
    mandante_token = resp.json()["token"]
    print("✅ Mandante login successful")
    
    time.sleep(0.5)
    
    # 3. Get mandantes list
    print("\n3. Get mandantes list...")
    resp = requests.get(f"{BASE_URL}/mandantes", 
                       headers={"Authorization": f"Bearer {admin_token}"}, 
                       timeout=30)
    assert resp.status_code == 200, f"Get mandantes failed: {resp.status_code}"
    mandantes = resp.json()["mandantes"]
    assert len(mandantes) > 0, "No mandantes found"
    mandante_id = mandantes[0]["mandante_id"]
    print(f"✅ Found {len(mandantes)} mandantes, using: {mandantes[0]['razon_social']}")
    
    time.sleep(0.5)
    
    # 4. Get mandante detail with categorias and requisitos
    print(f"\n4. Get mandante detail (ID: {mandante_id})...")
    resp = requests.get(f"{BASE_URL}/mandantes/{mandante_id}", 
                       headers={"Authorization": f"Bearer {admin_token}"}, 
                       timeout=30)
    assert resp.status_code == 200, f"Get mandante detail failed: {resp.status_code}"
    data = resp.json()
    assert "categorias" in data, "Missing categorias field"
    assert "requisitos" in data, "Missing requisitos field"
    categorias = data["categorias"]
    requisitos = data["requisitos"]
    print(f"✅ Mandante has {len(categorias)} categorias and {len(requisitos)} requisitos")
    
    # If no categorias/requisitos, create them
    if len(categorias) == 0:
        print("\n5a. Creating test categoria...")
        resp = requests.post(f"{BASE_URL}/categorias",
                           headers={"Authorization": f"Bearer {admin_token}"},
                           json={
                               "mandante_id": mandante_id,
                               "tipo_recurso": "trabajador",
                               "nombre": "Test Category",
                               "descripcion": "Test Description"
                           },
                           timeout=30)
        assert resp.status_code == 201, f"Create categoria failed: {resp.status_code} - {resp.text}"
        categoria_id = resp.json()["categoria"]["categoria_id"]
        print(f"✅ Created categoria: {categoria_id}")
        time.sleep(0.5)
    else:
        categoria_id = categorias[0]["categoria_id"]
        print(f"\n5a. Using existing categoria: {categoria_id}")
    
    if len(requisitos) == 0:
        print("\n5b. Creating test requisito...")
        resp = requests.post(f"{BASE_URL}/requisitos",
                           headers={"Authorization": f"Bearer {admin_token}"},
                           json={
                               "mandante_id": mandante_id,
                               "tipo_recurso": "trabajador",
                               "categoria_id": categoria_id,
                               "nombre": "Test Document",
                               "descripcion": "Test Description",
                               "obligatorio": True,
                               "tiene_vencimiento": True,
                               "transversal": False,
                               "dias_alerta": 30
                           },
                           timeout=30)
        assert resp.status_code == 201, f"Create requisito failed: {resp.status_code} - {resp.text}"
        requisito_id = resp.json()["requisito"]["requisito_id"]
        print(f"✅ Created requisito: {requisito_id}")
        time.sleep(0.5)
    else:
        requisito_id = requisitos[0]["requisito_id"]
        print(f"\n5b. Using existing requisito: {requisito_id}")
    
    # 6. Edit categoria as admin
    print(f"\n6. Edit categoria {categoria_id} as admin...")
    resp = requests.put(f"{BASE_URL}/categorias/{categoria_id}",
                       headers={"Authorization": f"Bearer {admin_token}"},
                       json={
                           "nombre": "Cat Editada QA",
                           "descripcion": "Desc editada QA"
                       },
                       timeout=30)
    assert resp.status_code == 200, f"Edit categoria failed: {resp.status_code} - {resp.text}"
    updated_cat = resp.json()["categoria"]
    assert updated_cat["nombre"] == "Cat Editada QA", f"Nombre not updated: {updated_cat['nombre']}"
    assert updated_cat["descripcion"] == "Desc editada QA", f"Descripcion not updated: {updated_cat['descripcion']}"
    print(f"✅ Categoria updated: nombre={updated_cat['nombre']}, descripcion={updated_cat['descripcion']}")
    
    time.sleep(0.5)
    
    # 7. Verify categoria edit persisted
    print(f"\n7. Verify categoria edit persisted...")
    resp = requests.get(f"{BASE_URL}/mandantes/{mandante_id}", 
                       headers={"Authorization": f"Bearer {admin_token}"}, 
                       timeout=30)
    assert resp.status_code == 200, f"Get mandante failed: {resp.status_code}"
    categorias = resp.json()["categorias"]
    found_cat = next((c for c in categorias if c["categoria_id"] == categoria_id), None)
    assert found_cat is not None, "Edited categoria not found"
    assert found_cat["nombre"] == "Cat Editada QA", f"Nombre not persisted: {found_cat['nombre']}"
    assert found_cat["descripcion"] == "Desc editada QA", f"Descripcion not persisted: {found_cat['descripcion']}"
    print(f"✅ Categoria changes persisted correctly")
    
    time.sleep(0.5)
    
    # 8. Edit requisito as admin (including transversal field)
    print(f"\n8. Edit requisito {requisito_id} as admin...")
    resp = requests.put(f"{BASE_URL}/requisitos/{requisito_id}",
                       headers={"Authorization": f"Bearer {admin_token}"},
                       json={
                           "obligatorio": False,
                           "tiene_vencimiento": False,
                           "transversal": True,
                           "descripcion": "Doc editado QA"
                       },
                       timeout=30)
    assert resp.status_code == 200, f"Edit requisito failed: {resp.status_code} - {resp.text}"
    updated_req = resp.json()["requisito"]
    assert updated_req["obligatorio"] == False, f"obligatorio not updated: {updated_req['obligatorio']}"
    assert updated_req["tiene_vencimiento"] == False, f"tiene_vencimiento not updated: {updated_req['tiene_vencimiento']}"
    assert updated_req["transversal"] == True, f"transversal not updated: {updated_req['transversal']}"
    assert updated_req["descripcion"] == "Doc editado QA", f"descripcion not updated: {updated_req['descripcion']}"
    print(f"✅ Requisito updated: obligatorio={updated_req['obligatorio']}, tiene_vencimiento={updated_req['tiene_vencimiento']}, transversal={updated_req['transversal']}, descripcion={updated_req['descripcion']}")
    
    time.sleep(0.5)
    
    # 9. Verify requisito edit persisted
    print(f"\n9. Verify requisito edit persisted...")
    resp = requests.get(f"{BASE_URL}/mandantes/{mandante_id}", 
                       headers={"Authorization": f"Bearer {admin_token}"}, 
                       timeout=30)
    assert resp.status_code == 200, f"Get mandante failed: {resp.status_code}"
    requisitos = resp.json()["requisitos"]
    found_req = next((r for r in requisitos if r["requisito_id"] == requisito_id), None)
    assert found_req is not None, "Edited requisito not found"
    assert found_req["obligatorio"] == False, f"obligatorio not persisted: {found_req['obligatorio']}"
    assert found_req["tiene_vencimiento"] == False, f"tiene_vencimiento not persisted: {found_req['tiene_vencimiento']}"
    assert found_req["transversal"] == True, f"transversal not persisted: {found_req['transversal']}"
    assert found_req["descripcion"] == "Doc editado QA", f"descripcion not persisted: {found_req['descripcion']}"
    print(f"✅ Requisito changes persisted correctly")
    
    time.sleep(0.5)
    
    # 10. Try to edit categoria as mandante (should fail with 403)
    print(f"\n10. Try to edit categoria as mandante (should fail with 403)...")
    resp = requests.put(f"{BASE_URL}/categorias/{categoria_id}",
                       headers={"Authorization": f"Bearer {mandante_token}"},
                       json={"nombre": "Unauthorized Edit"},
                       timeout=30)
    assert resp.status_code == 403, f"Expected 403, got {resp.status_code} - {resp.text}"
    print(f"✅ Categoria edit correctly rejected with 403 for mandante user")
    
    time.sleep(0.5)
    
    # 11. Try to edit requisito as mandante (should fail with 403)
    print(f"\n11. Try to edit requisito as mandante (should fail with 403)...")
    resp = requests.put(f"{BASE_URL}/requisitos/{requisito_id}",
                       headers={"Authorization": f"Bearer {mandante_token}"},
                       json={"descripcion": "Unauthorized Edit"},
                       timeout=30)
    assert resp.status_code == 403, f"Expected 403, got {resp.status_code} - {resp.text}"
    print(f"✅ Requisito edit correctly rejected with 403 for mandante user")
    
    time.sleep(0.5)
    
    # 12. Regression: POST /api/categorias still works
    print(f"\n12. Regression: POST /api/categorias...")
    resp = requests.post(f"{BASE_URL}/categorias",
                        headers={"Authorization": f"Bearer {admin_token}"},
                        json={
                            "mandante_id": mandante_id,
                            "tipo_recurso": "trabajador",
                            "nombre": "QA Cat Regression",
                            "descripcion": "QA"
                        },
                        timeout=30)
    assert resp.status_code == 201, f"Create categoria failed: {resp.status_code} - {resp.text}"
    print(f"✅ POST /api/categorias still works (201)")
    
    time.sleep(0.5)
    
    # 13. Regression: POST /api/requisitos still works
    print(f"\n13. Regression: POST /api/requisitos...")
    resp = requests.post(f"{BASE_URL}/requisitos",
                        headers={"Authorization": f"Bearer {admin_token}"},
                        json={
                            "mandante_id": mandante_id,
                            "tipo_recurso": "trabajador",
                            "categoria_id": categoria_id,
                            "nombre": "QA Doc Regression",
                            "obligatorio": True,
                            "tiene_vencimiento": True,
                            "transversal": False,
                            "dias_alerta": 30
                        },
                        timeout=30)
    assert resp.status_code == 201, f"Create requisito failed: {resp.status_code} - {resp.text}"
    print(f"✅ POST /api/requisitos still works (201)")
    
    time.sleep(0.5)
    
    # 14. Regression: GET /api/health
    print(f"\n14. Regression: GET /api/health...")
    resp = requests.get(f"{BASE_URL}/health", timeout=30)
    assert resp.status_code == 200, f"Health check failed: {resp.status_code}"
    assert resp.json()["ok"] == True, "Health check returned ok=false"
    print(f"✅ GET /api/health returns 200")
    
    time.sleep(0.5)
    
    # 15. Regression: Login all 4 roles
    print(f"\n15. Regression: Login all 4 roles...")
    roles = [
        ("admin@aptivarl.com", "SUPER_ADMIN_HOLDING"),
        ("empresa@aptivarl.com", "ADMIN_EMPRESA"),
        ("revisor@aptivarl.com", "REVISOR"),
        ("mandante@aptivarl.com", "USUARIO_MANDANTE")
    ]
    for email, expected_role in roles:
        resp = requests.post(f"{BASE_URL}/auth/login", json={
            "email": email,
            "password": "Aptiva2025!"
        }, timeout=30)
        assert resp.status_code == 200, f"Login failed for {email}: {resp.status_code}"
        profile = resp.json()["profile"]
        assert profile["role_codigo"] == expected_role, f"Wrong role for {email}: {profile['role_codigo']}"
        print(f"  ✅ {email} -> {expected_role}")
    
    print("\n" + "=" * 80)
    print("🎉 ALL PHASE 5 TESTS PASSED!")
    print("=" * 80)

if __name__ == "__main__":
    try:
        test_phase5()
    except AssertionError as e:
        print(f"\n❌ TEST FAILED: {e}")
        exit(1)
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        exit(1)
