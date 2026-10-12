import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from tests.test_health import test_root_health, test_db_health
from tests.test_customer_registration import (
    test_1_successful_customer_registration,
    test_2_duplicate_email_rejected,
    test_3_invalid_form_data_rejected,
    test_4_historical_customer_records_intact,
    test_5_new_customer_login_and_scoped_data
)
from tests.test_multi_user_access_model import (
    test_1_public_registration_forces_customer_role,
    test_2_seller_onboarding_application_and_approval_workflow,
    test_3_admin_only_user_provisioning,
    test_4_cross_customer_data_isolation,
    test_5_cross_seller_data_isolation,
    test_6_support_ticket_workflow_and_rbac_protection,
    test_7_operations_data_retrieval_and_db_status,
    test_8_dashboard_metrics_correctness
)
from tests.test_marketplace_governance import (
    test_account_deactivation_blocks_api_access,
    test_seller_suspension_blocks_selling_functions,
    test_pending_seller_blocks_selling_access,
    test_approved_seller_selling_access,
    test_duplicate_seller_application_prevention,
    test_admin_only_governance_operations,
    test_customer_store_application_submission_and_invalid_data,
    test_admin_approval_elevates_role_consistently
)
from tests.test_seller_dashboard_analytics import (
    test_1_new_approved_seller_zero_sales_and_orders,
    test_2_fulfillment_rate_na_when_no_eligible_orders,
    test_3_existing_seller_metrics_scoped_only_to_authorized_data,
    test_4_adding_product_updates_only_correct_seller_count,
    test_5_adding_valid_orders_updates_only_correct_seller_metrics,
    test_6_cross_seller_access_prevention,
    test_7_store_dropdown_endpoint_returns_only_authorized_stores,
    test_8_admin_global_metrics_integrity,
    test_9_historical_records_preservation
)
from tests.test_store_types_and_categories import (
    test_1_new_seller_application_with_valid_store_type,
    test_2_missing_and_invalid_store_types_handling,
    test_3_store_type_persists_and_returned_in_profile,
    test_4_shoes_shop_permitted_categories_filtering,
    test_5_electronics_store_permitted_categories_filtering,
    test_6_grocery_store_permitted_categories_filtering,
    test_7_general_store_permitted_categories,
    test_8_backend_rejects_unpermitted_category_for_store_type,
    test_9_seller_cannot_modify_other_seller_store_type,
    test_10_unapproved_sellers_cannot_bypass_restrictions
)

def run_all_tests():
    print("==================================================")
    print("   RUNNING BACKEND VERIFICATION TEST SUITE       ")
    print("==================================================")
    
    tests = [
        ("Health Check Endpoint", test_root_health),
        ("Database Connection Health Check", test_db_health),
        ("Customer Registration & DB Linking", test_1_successful_customer_registration),
        ("Duplicate Email Rejection", test_2_duplicate_email_rejected),
        ("Invalid Input Data Rejection", test_3_invalid_form_data_rejected),
        ("Historical 20k Customers Preservation", test_4_historical_customer_records_intact),
        ("New Customer Authentication & Scoped Profile", test_5_new_customer_login_and_scoped_data),
        ("Public Registration Privilege Escalation Prevention", test_1_public_registration_forces_customer_role),
        ("Seller Onboarding & Admin Approval Workflow", test_2_seller_onboarding_application_and_approval_workflow),
        ("Admin-Only User Provisioning", test_3_admin_only_user_provisioning),
        ("Cross-Customer Data Isolation", test_4_cross_customer_data_isolation),
        ("Cross-Seller Data Isolation", test_5_cross_seller_data_isolation),
        ("Support Ticket Workflow & RBAC Protection", test_6_support_ticket_workflow_and_rbac_protection),
        ("Operations Data Retrieval & DB Status", test_7_operations_data_retrieval_and_db_status),
        ("Dashboard Aggregated Metrics Correctness", test_8_dashboard_metrics_correctness),
        ("Account Deactivation Blocks API Access", test_account_deactivation_blocks_api_access),
        ("Seller Suspension Blocks Selling Functions", test_seller_suspension_blocks_selling_functions),
        ("Pending Seller Application Blocks Selling Operations", test_pending_seller_blocks_selling_access),
        ("Approved Seller Selling Access", test_approved_seller_selling_access),
        ("Duplicate Seller Application Prevention", test_duplicate_seller_application_prevention),
        ("Admin-Only Governance Operations Enforcement", test_admin_only_governance_operations),
        ("Customer Store Application Submission & Input Rejection", test_customer_store_application_submission_and_invalid_data),
        ("Admin Approval Elevates Role Consistently", test_admin_approval_elevates_role_consistently),
        ("New Approved Seller Zero Sales & Orders Isolation", test_1_new_approved_seller_zero_sales_and_orders),
        ("Fulfillment Rate N/A when No Eligible Orders", test_2_fulfillment_rate_na_when_no_eligible_orders),
        ("Existing Seller Authorized Data Scoping", test_3_existing_seller_metrics_scoped_only_to_authorized_data),
        ("Adding Product Scoped to Correct Seller", test_4_adding_product_updates_only_correct_seller_count),
        ("Adding Orders Scoped to Correct Seller Metrics", test_5_adding_valid_orders_updates_only_correct_seller_metrics),
        ("Cross-Seller Access & AI Copilot Endpoint Isolation", test_6_cross_seller_access_prevention),
        ("Store Dropdown Endpoint Restricted to Authorized Stores", test_7_store_dropdown_endpoint_returns_only_authorized_stores),
        ("Admin Global Metrics Integrity Preserved", test_8_admin_global_metrics_integrity),
        ("Historical Records & Reconciliation Preservation", test_9_historical_records_preservation),
        ("New Seller Application with Valid Store Type", test_1_new_seller_application_with_valid_store_type),
        ("Missing & Invalid Store Types Handling", test_2_missing_and_invalid_store_types_handling),
        ("Store Type Persistence & Profile Retrieval", test_3_store_type_persists_and_returned_in_profile),
        ("Shoes Shop Fashion/Footwear Category Filtering", test_4_shoes_shop_permitted_categories_filtering),
        ("Electronics Store Permitted Categories Filtering", test_5_electronics_store_permitted_categories_filtering),
        ("Grocery Store Permitted Categories Filtering", test_6_grocery_store_permitted_categories_filtering),
        ("General Store Permitted Categories", test_7_general_store_permitted_categories),
        ("Backend Rejects Unpermitted Category for Store Type", test_8_backend_rejects_unpermitted_category_for_store_type),
        ("Seller Cannot Modify Other Seller Store Type", test_9_seller_cannot_modify_other_seller_store_type),
        ("Unapproved Sellers Selling Restriction Enforcement", test_10_unapproved_sellers_cannot_bypass_restrictions)
    ]

    passed = 0
    failed = 0
    for name, func in tests:
        try:
            print(f"Running: {name}... ", end="", flush=True)
            func()
            print("PASSED [OK]")
            passed += 1
        except Exception as e:
            print(f"FAILED [ERROR] -> {e}")
            failed += 1

    print("\n==================================================")
    print(f"SUMMARY: {passed} PASSED, {failed} FAILED out of {len(tests)} tests.")
    print("==================================================")
    
    if failed > 0:
        sys.exit(1)

if __name__ == "__main__":
    run_all_tests()
