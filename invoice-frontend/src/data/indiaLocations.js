// ---------------------------------------------------------------------------
// State -> Cities -> Pincode data used to drive the cascading
// Country -> State -> City -> Pincode fields in Client Master.
//
// Each city carries a representative pincode (its head post office / most
// commonly used PIN for that city) so picking a city can auto-fill a
// sensible starting pincode. This is NOT an exhaustive locality-level PIN
// directory — a city can have many pincodes for different areas — so the
// Pincode field always stays editable; the auto-filled value is a helpful
// default, not a locked answer.
//
// Keys must match INDIAN_STATES / STATE_GST_CODES in invoiceFormOptions.js
// exactly, since the City dropdown looks up this list by the selected
// state's name.
// ---------------------------------------------------------------------------

export const STATE_CITIES = {
  "Jammu and Kashmir": [
    { name: "Srinagar", pincode: "190001" },
    { name: "Jammu", pincode: "180001" },
    { name: "Anantnag", pincode: "192101" },
    { name: "Baramulla", pincode: "193101" },
  ],
  "Himachal Pradesh": [
    { name: "Shimla", pincode: "171001" },
    { name: "Manali", pincode: "175131" },
    { name: "Dharamshala", pincode: "176215" },
    { name: "Solan", pincode: "173212" },
  ],
  "Punjab": [
    { name: "Ludhiana", pincode: "141001" },
    { name: "Amritsar", pincode: "143001" },
    { name: "Jalandhar", pincode: "144001" },
    { name: "Patiala", pincode: "147001" },
    { name: "Mohali", pincode: "160055" },
    { name: "Bathinda", pincode: "151001" },
  ],
  "Chandigarh": [{ name: "Chandigarh", pincode: "160001" }],
  "Uttarakhand": [
    { name: "Dehradun", pincode: "248001" },
    { name: "Haridwar", pincode: "249401" },
    { name: "Nainital", pincode: "263001" },
    { name: "Rishikesh", pincode: "249201" },
  ],
  "Haryana": [
    { name: "Gurugram", pincode: "122001" },
    { name: "Faridabad", pincode: "121001" },
    { name: "Panipat", pincode: "132103" },
    { name: "Ambala", pincode: "133001" },
    { name: "Karnal", pincode: "132001" },
    { name: "Hisar", pincode: "125001" },
  ],
  "Delhi": [
    { name: "New Delhi", pincode: "110001" },
    { name: "Dwarka", pincode: "110075" },
    { name: "Rohini", pincode: "110085" },
    { name: "Karol Bagh", pincode: "110005" },
    { name: "Saket", pincode: "110017" },
    { name: "Janakpuri", pincode: "110058" },
  ],
  "Rajasthan": [
    { name: "Jaipur", pincode: "302001" },
    { name: "Jodhpur", pincode: "342001" },
    { name: "Udaipur", pincode: "313001" },
    { name: "Kota", pincode: "324001" },
    { name: "Ajmer", pincode: "305001" },
    { name: "Bikaner", pincode: "334001" },
  ],
  "Uttar Pradesh": [
    { name: "Lucknow", pincode: "226001" },
    { name: "Kanpur", pincode: "208001" },
    { name: "Noida", pincode: "201301" },
    { name: "Ghaziabad", pincode: "201001" },
    { name: "Agra", pincode: "282001" },
    { name: "Varanasi", pincode: "221001" },
    { name: "Prayagraj", pincode: "211001" },
    { name: "Meerut", pincode: "250001" },
  ],
  "Bihar": [
    { name: "Patna", pincode: "800001" },
    { name: "Gaya", pincode: "823001" },
    { name: "Muzaffarpur", pincode: "842001" },
    { name: "Bhagalpur", pincode: "812001" },
  ],
  "Sikkim": [{ name: "Gangtok", pincode: "737101" }],
  "Arunachal Pradesh": [{ name: "Itanagar", pincode: "791111" }],
  "Nagaland": [{ name: "Kohima", pincode: "797001" }, { name: "Dimapur", pincode: "797112" }],
  "Manipur": [{ name: "Imphal", pincode: "795001" }],
  "Mizoram": [{ name: "Aizawl", pincode: "796001" }],
  "Tripura": [{ name: "Agartala", pincode: "799001" }],
  "Meghalaya": [{ name: "Shillong", pincode: "793001" }],
  "Assam": [
    { name: "Guwahati", pincode: "781001" },
    { name: "Dibrugarh", pincode: "786001" },
    { name: "Silchar", pincode: "788001" },
    { name: "Jorhat", pincode: "785001" },
  ],
  "West Bengal": [
    { name: "Kolkata", pincode: "700001" },
    { name: "Howrah", pincode: "711101" },
    { name: "Durgapur", pincode: "713201" },
    { name: "Siliguri", pincode: "734001" },
    { name: "Asansol", pincode: "713301" },
  ],
  "Jharkhand": [
    { name: "Ranchi", pincode: "834001" },
    { name: "Jamshedpur", pincode: "831001" },
    { name: "Dhanbad", pincode: "826001" },
    { name: "Bokaro", pincode: "827001" },
  ],
  "Odisha": [
    { name: "Bhubaneswar", pincode: "751001" },
    { name: "Cuttack", pincode: "753001" },
    { name: "Rourkela", pincode: "769001" },
    { name: "Puri", pincode: "752001" },
  ],
  "Chhattisgarh": [
    { name: "Raipur", pincode: "492001" },
    { name: "Bhilai", pincode: "490001" },
    { name: "Bilaspur", pincode: "495001" },
  ],
  "Madhya Pradesh": [
    { name: "Bhopal", pincode: "462001" },
    { name: "Indore", pincode: "452001" },
    { name: "Gwalior", pincode: "474001" },
    { name: "Jabalpur", pincode: "482001" },
    { name: "Ujjain", pincode: "456001" },
  ],
  "Gujarat": [
    { name: "Ahmedabad", pincode: "380001" },
    { name: "Surat", pincode: "395001" },
    { name: "Vadodara", pincode: "390001" },
    { name: "Rajkot", pincode: "360001" },
    { name: "Bhavnagar", pincode: "364001" },
    { name: "Gandhinagar", pincode: "382001" },
  ],
  "Daman and Diu": [{ name: "Daman", pincode: "396210" }, { name: "Diu", pincode: "362520" }],
  "Dadra and Nagar Haveli": [{ name: "Silvassa", pincode: "396230" }],
  "Maharashtra": [
    { name: "Mumbai", pincode: "400001" },
    { name: "Pune", pincode: "411001" },
    { name: "Nagpur", pincode: "440001" },
    { name: "Nashik", pincode: "422001" },
    { name: "Thane", pincode: "400601" },
    { name: "Aurangabad", pincode: "431001" },
    { name: "Solapur", pincode: "413001" },
    { name: "Kolhapur", pincode: "416001" },
  ],
  "Karnataka": [
    { name: "Bengaluru", pincode: "560001" },
    { name: "Mysuru", pincode: "570001" },
    { name: "Mangaluru", pincode: "575001" },
    { name: "Hubballi", pincode: "580001" },
    { name: "Belagavi", pincode: "590001" },
  ],
  "Goa": [{ name: "Panaji", pincode: "403001" }, { name: "Margao", pincode: "403601" }, { name: "Vasco da Gama", pincode: "403802" }],
  "Lakshadweep": [{ name: "Kavaratti", pincode: "682555" }],
  "Kerala": [
    { name: "Thiruvananthapuram", pincode: "695001" },
    { name: "Kochi", pincode: "682001" },
    { name: "Kozhikode", pincode: "673001" },
    { name: "Thrissur", pincode: "680001" },
  ],
  "Tamil Nadu": [
    { name: "Chennai", pincode: "600001" },
    { name: "Coimbatore", pincode: "641001" },
    { name: "Madurai", pincode: "625001" },
    { name: "Tiruchirappalli", pincode: "620001" },
    { name: "Salem", pincode: "636001" },
  ],
  "Puducherry": [{ name: "Puducherry", pincode: "605001" }],
  "Andaman and Nicobar Islands": [{ name: "Port Blair", pincode: "744101" }],
  "Telangana": [
    { name: "Hyderabad", pincode: "500001" },
    { name: "Warangal", pincode: "506002" },
    { name: "Nizamabad", pincode: "503001" },
  ],
  "Andhra Pradesh": [
    { name: "Visakhapatnam", pincode: "530001" },
    { name: "Vijayawada", pincode: "520001" },
    { name: "Guntur", pincode: "522001" },
    { name: "Tirupati", pincode: "517501" },
  ],
  "Ladakh": [{ name: "Leh", pincode: "194101" }],
};
