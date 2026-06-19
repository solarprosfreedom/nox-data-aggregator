import { pickField, parseDate, parseNumeric } from "@/lib/csv/parse";

export function mapProjectsSheetRow(row: Record<string, string>) {
  const projectId = pickField(row, "HES ID", "HES Code", "HES_ID", "project_id");
  if (!projectId) return null;

  const firstName = pickField(row, "First Name");
  const lastName = pickField(row, "Last Name");
  const opportunityName = pickField(row, "Opportunity Name");

  return {
    project_id: projectId,
    opportunity_name:
      opportunityName || [firstName, lastName].filter(Boolean).join(" ") || null,
    first_name: firstName || null,
    last_name: lastName || null,
    address_line1: pickField(row, "Street Address", "Address") || null,
    city: pickField(row, "City") || null,
    state_code: pickField(row, "State") || null,
    postal_code: pickField(row, "Zip Code", "Zip") || null,
    email: pickField(row, "Email Address", "Email") || null,
    phone: pickField(row, "Primary Phone Number", "Phone") || null,
    sales_advisor_name:
      pickField(row, "Sales Advisor: Full Name", "Sales Advisor") || null,
    sales_advisor_email: pickField(row, "Sales Advisor: Email") || null,
    project_stage: pickField(row, "Project Stage", "Stage") || null,
    contract_signed_date: parseDate(
      pickField(row, "Original Contract Signed date", "Contract Date")
    ),
    total_system_cost: parseNumeric(pickField(row, "Total System Cost")),
    system_size_kw: parseNumeric(
      pickField(row, "System Size (kW)", "System Size")
    ),
    installer: pickField(row, "Installer", "Dealer", "Dealer Name", "Sales Partner") || null,
    updated_at: new Date().toISOString(),
  };
}

export function mapTerrosRow(row: Record<string, string>) {
  const accountId = pickField(row, "accountId", "Account ID", "account_id", "id");
  const projectId = pickField(row, "HES ID", "externalLeadId", "hes_id", "project_id");
  const firstName = pickField(row, "resident.firstName", "First Name", "resident_first_name");
  const lastName = pickField(row, "resident.lastName", "Last Name", "resident_last_name");
  const customerName =
    pickField(row, "Customer Name", "name", "resident.name") ||
    [firstName, lastName].filter(Boolean).join(" ");

  if (!accountId && !projectId && !customerName) return null;

  return {
    project_id: projectId || null,
    terros_account_id: accountId || null,
    opportunity_name: customerName || null,
    first_name: firstName || null,
    last_name: lastName || null,
    email: pickField(row, "resident.email", "Email", "email") || null,
    phone: pickField(row, "resident.phone", "Phone", "phone") || null,
    address_line1: pickField(row, "address.line1", "Address", "line1") || null,
    city: pickField(row, "address.locality", "City", "locality") || null,
    state_code: pickField(row, "address.countrySubd", "State", "countrySubd") || null,
    postal_code: pickField(row, "address.postal1", "Zip", "postal1") || null,
    setter_email: pickField(row, "owner.email", "Owner Email", "setter_email") || null,
    setter_name: pickField(row, "owner.name", "Owner Name", "setter_name") || null,
    project_stage: pickField(row, "workflowStage", "Stage", "workflow_stage") || null,
    updated_at: new Date().toISOString(),
  };
}

export function mapRemittanceRow(row: Record<string, string>, rowNumber: number) {
  const hesCode = pickField(row, "HES Code", "HES ID");
  const paymentDate = parseDate(pickField(row, "Payment date", "Payment Date"));
  if (!hesCode || !paymentDate) return null;

  return {
    payment_date: paymentDate,
    hes_code: hesCode,
    customer_name: pickField(row, "Customer Name") || null,
    sales_partner: pickField(row, "Sales Partner") || null,
    sales_advisor: pickField(row, "Sales Advisor") || null,
    channel: pickField(row, "Channel") || null,
    status: pickField(row, "Status") || null,
    latest_contract: pickField(row, "Latest Contract") || null,
    contract_date: parseDate(pickField(row, "Contract Date")),
    finance_type: pickField(row, "Finance Type") || null,
    financier: pickField(row, "Financier") || null,
    utility_provider: pickField(row, "Utility Provider") || null,
    pv_size: parseNumeric(pickField(row, "① PV Size", "PV Size")),
    redline_price_tier: parseNumeric(
      pickField(row, "② Redline Price (Tier Based)", "Redline Price")
    ),
    contract_amount: parseNumeric(pickField(row, "Contract Amount")),
    gross_ppw: parseNumeric(pickField(row, "Gross PPW")),
    finance_fee: parseNumeric(pickField(row, "Finance Fee")),
    cash_deal_value: parseNumeric(
      pickField(row, "③ Cash Deal Value (Excl. dealer fee)", "Cash Deal Value")
    ),
    battery_price: parseNumeric(pickField(row, "④ Battery Price", "Battery Price")),
    adder_amount: parseNumeric(pickField(row, "⑤ Adder Amount", "Adder Amount")),
    contract_adder_detail: pickField(row, "Contract Adder Detail") || null,
    post_sale_adder_work_order: parseNumeric(
      pickField(row, "Post Sale Adder from Work Order and Service Fee")
    ),
    post_sale_adders: parseNumeric(
      pickField(row, "⑥ Post Sale Adders", "Post Sale Adders")
    ),
    pv_only_price: parseNumeric(
      pickField(row, "⑦ PV Only Price (③-④-⑤)", "PV Only Price")
    ),
    ppw: parseNumeric(pickField(row, "PPW")),
    down_payment: parseNumeric(pickField(row, "⑧ Down Payment", "Down Payment")),
    spif: parseNumeric(pickField(row, "⑨ SPIF", "SPIF")),
    tpo_rebate: parseNumeric(pickField(row, "⑩ TPO Rebate (Jan 1st - Nov 30 )", "⑩ TPO Rebate", "TPO Rebate")),
    etqa: parseNumeric(pickField(row, "⑪ETQA (Apr 1st - Apr 30th)", "ETQA")),
    enfin_dca: parseNumeric(pickField(row, "⑫Enfin DCA (May 1st - )", "Enfin DCA")),
    light_reach_dca: parseNumeric(
      pickField(row, "⑬ Light Reach DCA (Oct 1st - ", "Light Reach DCA")
    ),
    partner_commission: parseNumeric(
      pickField(row, "Partner's Commission (⑦-①*②-⑥-⑧+⑨)", "Partner Commission")
    ),
    partner_incentive: parseNumeric(
      pickField(row, "Partner's Incentive (⑩+⑪+⑫+⑬)", "Partner Incentive")
    ),
    re_payment: parseNumeric(pickField(row, "Re-Payment (starting on 7/1)", "Re-Payment")),
    c0: parseNumeric(pickField(row, "C0")),
    c1: parseNumeric(pickField(row, "C1", "C1 \n", "C1\n")),
    c2: parseNumeric(pickField(row, "C2", "C2\n")),
    adjusted_c2: parseNumeric(pickField(row, "Adjusted C2")),
    c0_paid: parseNumeric(pickField(row, "C0 Paid")),
    c1_paid: parseNumeric(pickField(row, "C1 Paid")),
    c2_paid: parseNumeric(pickField(row, "C2 Paid")),
    incentive_paid: parseNumeric(pickField(row, "Incentive Paid")),
    clawback: parseNumeric(pickField(row, "Clawback")),
    others: parseNumeric(pickField(row, "Others")),
    total_sp_paid: parseNumeric(pickField(row, "Total SP Paid")),
    payment_this_week: parseNumeric(pickField(row, "Payment This Week")),
    row_number: rowNumber,
    raw_row: row,
  };
}
