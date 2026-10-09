// ---------------------------------------------------------------------------
// Static option lists that drive the Create Invoice form's dropdowns.
// Kept separate from billingLocations.js since these aren't tied to a
// specific location — swap for an API-backed list later without touching
// the rest of the form.
// ---------------------------------------------------------------------------

export const INVOICE_TYPES = [
  { value: "DIRECT", label: "Direct Invoice" },
  { value: "MILESTONE", label: "Milestone" },
];

export const GST_RATES = [5, 12, 18, 28];

// Indian states/UTs with their official 2-digit GST state code. This is
// the single source of truth for the state dropdowns (Create Invoice,
// Client Master) and for the state_code sent to the backend.
export const STATE_GST_CODES = {
  "Jammu and Kashmir": "01",
  "Himachal Pradesh": "02",
  "Punjab": "03",
  "Chandigarh": "04",
  "Uttarakhand": "05",
  "Haryana": "06",
  "Delhi": "07",
  "Rajasthan": "08",
  "Uttar Pradesh": "09",
  "Bihar": "10",
  "Sikkim": "11",
  "Arunachal Pradesh": "12",
  "Nagaland": "13",
  "Manipur": "14",
  "Mizoram": "15",
  "Tripura": "16",
  "Meghalaya": "17",
  "Assam": "18",
  "West Bengal": "19",
  "Jharkhand": "20",
  "Odisha": "21",
  "Chhattisgarh": "22",
  "Madhya Pradesh": "23",
  "Gujarat": "24",
  "Daman and Diu": "25",
  "Dadra and Nagar Haveli": "26",
  "Maharashtra": "27",
  "Karnataka": "29",
  "Goa": "30",
  "Lakshadweep": "31",
  "Kerala": "32",
  "Tamil Nadu": "33",
  "Puducherry": "34",
  "Andaman and Nicobar Islands": "35",
  "Telangana": "36",
  "Andhra Pradesh": "37",
  "Ladakh": "38",
};

export const INDIAN_STATES = Object.keys(STATE_GST_CODES);

export const SERVICE_CATALOG = [
  "Website Design & Development",
  "E-commerce Development",
  "Mobile App Development",
  "SEO & Digital Marketing",
  "Social Media Management",
  "Branding & Logo Design",
  "UI/UX Design",
  "Maintenance & Support",
  "Custom Service",
  "Domain Renewal",
  "Hosting Renewal",
  "Annual maintenance Charges (AMC)"
];

export const TERMS_PRESETS = [
  { value: "7_DAYS", label: "Payment within 7 days of invoice", text: "Please ensure that payment is made within seven days of receipt of this invoice." },
  { value: "15_DAYS", label: "Payment within 15 days of invoice", text: "Please ensure that payment is made within fifteen days of receipt of this invoice." },
  { value: "ON_RECEIPT", label: "Payment due on receipt", text: "Payment is due immediately upon receipt of this invoice." },
  { value: "ADVANCE_50", label: "50% advance, balance on delivery", text: "50% payment is due in advance, with the remaining balance payable on delivery." },
  { value: "CUSTOM", label: "Custom", text: "" },
];

export const PAYMENT_METHOD_OPTIONS = [
  { value: "BANK_TRANSFER", label: "Bank Transfer (Bank Details on Invoice)" },
  { value: "UPI", label: "UPI (QR Code on Invoice)" },
  { value: "CHEQUE", label: "Cheque" },
  { value: "CASH", label: "Cash" },
];

// Used by the "Mark as Paid" popup on the invoice detail page.
export const PAYMENT_MODE_OPTIONS = [
  { value: "BANK_TRANSFER", label: "Bank Transfer" },
  { value: "UPI", label: "UPI" },
  { value: "CHEQUE", label: "Cheque" },
  { value: "CASH", label: "Cash" },
];
