export const billingLocations = [
  {
    id: 1,
    name: "GST",
    state: "Maharashtra",
    location_type: "GST",
    gst_number: "27ABKFR6662C1ZZ",
    pan_number: "ABKFR6662C",
    default_gst_percentage: 18,
    bank_name: "Indusind Bank",
    account_name: "ROOFZE DIGITAL HUB LLP",
    account_number: "258916532869",
    ifsc_code: "INDB0001889",
    qr_code_url: null,
    is_active: true,
  },

  {
    id: 2,
    name: "Without GST",
    state: "Delhi",
    location_type: "NON_GST",
    gst_number: null,
    pan_number: null,
    default_gst_percentage: null,
    bank_name: "Indusind Bank",
    account_name: "ROOFZE DIGITAL HUB LLP",
    account_number: "258916532869",
    ifsc_code: "INDB0001889",
    // No hosted QR image yet — InvoicePreview renders a placeholder box.
    // Once a real QR image exists, put it in /public and point this at it,
    // e.g. "/qr-code.png".
    qr_code_url: null,
    is_active: true,
  },
];
