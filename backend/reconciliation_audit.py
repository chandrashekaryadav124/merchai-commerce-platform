import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from sqlalchemy import text
from app.db.session import engine

def audit_reconciliation():
    print("==========================================================")
    print("   READ-ONLY RECONCILIATION AUDIT REPORT                  ")
    print("==========================================================")
    
    with engine.connect() as conn:
        # 1. Total counts
        user_cnt = conn.execute(text("SELECT COUNT(*) FROM app_users;")).fetchone()[0]
        seller_cnt = conn.execute(text("SELECT COUNT(*) FROM sellers;")).fetchone()[0]
        demo_cnt = conn.execute(text("SELECT COUNT(*) FROM app_users WHERE is_demo_account = 1;")).fetchone()[0]
        
        print(f"Total app_users: {user_cnt}")
        print(f"Total sellers: {seller_cnt}")
        print(f"Demo/Seeded accounts (is_demo_account=1): {demo_cnt}\n")

        # 2. Inspect all seller records and their linked user status/role
        print("--- SELLER STOREFRONT RECONCILIATION ---")
        sellers = list(conn.execute(text("""
            SELECT s.seller_id, s.store_name, s.user_id, s.approval_status, s.contact_email,
                   u.email as user_email, u.role as user_role, u.is_active as user_active, u.is_demo_account
            FROM sellers s
            LEFT JOIN app_users u ON s.user_id = u.user_id;
        """)))
        
        inconsistencies = []
        for s in sellers:
            m = dict(s._mapping)
            seller_id = m['seller_id']
            store_name = m['store_name']
            uid = m['user_id']
            app_status = m['approval_status']
            u_role = m['user_role']
            u_active = m['user_active']
            
            # Check for inconsistencies
            issues = []
            if uid is None:
                issues.append("Unlinked seller profile (user_id IS NULL)")
            elif u_role is None:
                issues.append(f"Linked user_id {uid} does not exist in app_users")
            else:
                if app_status == "approved" and u_role != "seller" and u_role != "admin":
                    issues.append(f"Seller approved but app_users.role is '{u_role}' (expected 'seller' or 'admin')")
                if app_status == "pending" and u_role == "seller":
                    issues.append(f"Seller pending but app_users.role is already 'seller'")
                if u_active == 0 and app_status == "approved":
                    issues.append(f"Seller status is 'approved' but linked app_user is DEACTIVATED (is_active=0)")
                    
            if issues:
                inconsistencies.append((seller_id, store_name, app_status, u_role, u_active, issues))

            print(f"[{m['seller_id']}] Store: '{m['store_name']}' | AppStatus: {m['approval_status']} | UserID: {m['user_id']} | UserRole: {m['user_role']} | UserActive: {m['user_active']}")

        print("\n----------------------------------------------------------")
        print(f"CONFIRMED INCONSISTENCIES FOUND ({len(inconsistencies)} issues):")
        print("----------------------------------------------------------")
        if not inconsistencies:
            print("None! All seller and user states match expected business rules.")
        else:
            for sid, sname, astat, urole, uact, iss in inconsistencies:
                print(f"• Seller '{sid}' ({sname}): Status={astat}, UserRole={urole}, UserActive={uact}")
                for i in iss:
                    print(f"   -> Issue: {i}")

        print("\n--- USER DIRECTORY SUMMARY BY ROLE & STATUS ---")
        user_summary = list(conn.execute(text("""
            SELECT role, is_active, is_demo_account, COUNT(*) as count
            FROM app_users
            GROUP BY role, is_active, is_demo_account;
        """)))
        for row in user_summary:
            m = dict(row._mapping)
            print(f"Role: {m['role']} | Active: {m['is_active']} | IsDemo: {m['is_demo_account']} | Count: {m['count']}")

if __name__ == "__main__":
    audit_reconciliation()
