import type { CategoryFormSchema } from "./types";

export const CATEGORY_SCHEMAS: Record<string, CategoryFormSchema> = {
  // 1. Education & Tuition
  "tutoring": {
    categoryId: "tutoring",
    slug: "education-tuition",
    displayName: "Education & Tuition",
    schemaVersion: 1,
    subcategories: [
      { label: "School Tuition", value: "school-tuition", hint: "Classes 1-12, all boards" },
      { label: "Intermediate Tuition", value: "intermediate-tuition", hint: "MPC, BiPC, MEC, CEC" },
      { label: "Degree Coaching", value: "degree-coaching", hint: "B.Sc, B.Com, B.Tech, etc." },
      { label: "Competitive Exam Coaching", value: "competitive-exams", hint: "JEE, NEET, EAMCET, UPSC, Banking" },
      { label: "Language Training", value: "language-training", hint: "Spoken English, German, French, etc." },
      { label: "Computer Training", value: "computer-training", hint: "Coding, Data, Web, Python, Office" },
      { label: "Skill Training", value: "skill-training", hint: "Vocational & Professional skills" },
      { label: "Music & Arts", value: "music-arts", hint: "Vocal, Guitar, Keyboard, Painting" },
    ],
    sections: [
      {
        id: "teaching-details",
        title: "Teaching Details",
        description: "Configure what and how you teach",
        fields: [
          {
            key: "teachingType",
            label: "Teaching Type",
            type: "single_select",
            required: true,
            options: [
              { label: "School Tuition", value: "school-tuition" },
              { label: "Intermediate Tuition", value: "intermediate-tuition" },
              { label: "Degree Coaching", value: "degree-coaching" },
              { label: "Competitive Exams", value: "competitive-exams" },
              { label: "Language Training", value: "language-training" },
              { label: "Computer Training", value: "computer-training" },
              { label: "Other Skill", value: "other-skill" },
            ],
          },
          {
            key: "schoolClasses",
            label: "Classes Taught",
            type: "multi_select",
            required: true,
            condition: { field: "teachingType", operator: "equals", value: "school-tuition" },
            options: [
              { label: "Class 1 - 5 (Primary)", value: "primary" },
              { label: "Class 6 - 8 (Middle)", value: "middle" },
              { label: "Class 9 - 10 (Secondary)", value: "secondary" },
              { label: "Class 11 - 12 (Higher Secondary)", value: "higher-secondary" },
            ],
          },
          {
            key: "boards",
            label: "Educational Boards",
            type: "multi_select",
            required: true,
            condition: { field: "teachingType", operator: "equals", value: "school-tuition" },
            options: [
              { label: "CBSE", value: "cbse" },
              { label: "ICSE", value: "icse" },
              { label: "State Board (SSC / Inter)", value: "state-board" },
              { label: "IB / Cambridge", value: "international" },
            ],
          },
          {
            key: "subjects",
            label: "Subjects Taught",
            type: "multi_select",
            required: true,
            condition: { field: "teachingType", operator: "in", value: ["school-tuition", "intermediate-tuition", "degree-coaching"] },
            options: [
              { label: "Mathematics", value: "mathematics" },
              { label: "Physics", value: "physics" },
              { label: "Chemistry", value: "chemistry" },
              { label: "Biology", value: "biology" },
              { label: "English", value: "english" },
              { label: "Social Studies", value: "social-studies" },
              { label: "Computer Science", value: "computer-science" },
              { label: "Commerce / Accounts", value: "commerce-accounts" },
            ],
          },
          {
            key: "targetExams",
            label: "Competitive Exams",
            type: "multi_select",
            required: true,
            condition: { field: "teachingType", operator: "equals", value: "competitive-exams" },
            options: [
              { label: "JEE Main & Advanced", value: "jee" },
              { label: "NEET", value: "neet" },
              { label: "EAMCET", value: "eamcet" },
              { label: "GATE", value: "gate" },
              { label: "UPSC / State PSC", value: "civil-services" },
              { label: "Banking & SSC", value: "banking-ssc" },
            ],
          },
          {
            key: "languagesTaught",
            label: "Languages Taught",
            type: "multi_select",
            required: true,
            condition: { field: "teachingType", operator: "equals", value: "language-training" },
            options: [
              { label: "Spoken English", value: "spoken-english" },
              { label: "Hindi", value: "hindi" },
              { label: "Telugu", value: "telugu" },
              { label: "French", value: "french" },
              { label: "German", value: "german" },
              { label: "Japanese", value: "japanese" },
            ],
          },
          {
            key: "teachingMode",
            label: "Teaching Mode",
            type: "multi_select",
            required: true,
            options: [
              { label: "Home Visit (Tutor visits student)", value: "home-visit" },
              { label: "Online (Video Call)", value: "online" },
              { label: "Tutor Location / Center", value: "tutor-center" },
            ],
          },
          {
            key: "batchType",
            label: "Batch Format",
            type: "single_select",
            required: true,
            options: [
              { label: "1-on-1 Individual", value: "individual" },
              { label: "Small Group (2-5 students)", value: "small-group" },
              { label: "Batch (6+ students)", value: "batch" },
              { label: "Both 1-on-1 & Group", value: "both" },
            ],
          },
          {
            key: "demoClass",
            label: "Demo Class Option",
            type: "single_select",
            required: true,
            options: [
              { label: "Free Demo Available", value: "free" },
              { label: "Paid Trial Session", value: "paid" },
              { label: "No Demo Class", value: "none" },
            ],
          },
          {
            key: "qualification",
            label: "Highest Qualification",
            type: "text",
            required: true,
            placeholder: "e.g. M.Sc. Mathematics, B.Tech CSE, Ph.D.",
          },
        ],
      },
    ],
  },

  // 2. Plumbing
  "plumber": {
    categoryId: "plumber",
    slug: "plumbing",
    displayName: "Plumbing",
    schemaVersion: 1,
    subcategories: [
      { label: "Pipe Repair & Fitting", value: "pipe-repair" },
      { label: "Leakage Repair", value: "leakage-repair" },
      { label: "Tap & Shower Installation", value: "tap-installation" },
      { label: "Bathroom Sanitary Fittings", value: "bathroom-fittings" },
      { label: "Drainage & Blockage Cleaning", value: "drainage" },
      { label: "Water Tank Installation & Cleaning", value: "water-tank" },
      { label: "Water Pipeline Maintenance", value: "pipeline-maintenance" },
    ],
    sections: [
      {
        id: "plumbing-scope",
        title: "Work Scope & Capabilities",
        fields: [
          {
            key: "workTypes",
            label: "Plumbing Work Specialties",
            type: "multi_select",
            required: true,
            options: [
              { label: "Leakage Detection & Fix", value: "leakage" },
              { label: "Tap & Valve Replacement", value: "taps" },
              { label: "Toilet / Commode Fitting", value: "commode" },
              { label: "Geyser Inlet / Outlet Fitting", value: "geyser" },
              { label: "Drain Blockage Removal", value: "blockage" },
              { label: "Motor Pump & Tank Pipeline", value: "motor-tank" },
              { label: "Complete Bathroom Plumbing", value: "full-bathroom" },
            ],
          },
          {
            key: "propertyTypes",
            label: "Property Types Handled",
            type: "multi_select",
            required: true,
            options: [
              { label: "Apartments & Flats", value: "apartments" },
              { label: "Independent Houses & Villas", value: "villas" },
              { label: "Offices & Commercial Spaces", value: "commercial" },
            ],
          },
          {
            key: "materialsProvided",
            label: "Materials & Spare Parts",
            type: "single_select",
            required: true,
            options: [
              { label: "Customer provides materials", value: "customer" },
              { label: "Provider brings materials (billed extra)", value: "provider" },
              { label: "Either (decided on inspection)", value: "either" },
            ],
          },
          {
            key: "emergencyService",
            label: "Emergency Availability",
            type: "toggle",
            required: false,
            description: "Are you available for urgent water leakage or pipe burst calls?",
          },
        ],
      },
    ],
  },

  // 3. Electrical
  "electrician": {
    categoryId: "electrician",
    slug: "electrical",
    displayName: "Electrical",
    schemaVersion: 1,
    subcategories: [
      { label: "Home Wiring & Rewiring", value: "home-wiring" },
      { label: "Fan & Light Installation", value: "fans-lights" },
      { label: "Switch & Socket Repair", value: "switches" },
      { label: "MCB & Distribution Board Work", value: "mcb-db" },
      { label: "Inverter & Battery Wiring", value: "inverter" },
      { label: "Electrical Maintenance", value: "maintenance" },
      { label: "Commercial Electrical Work", value: "commercial-electrical" },
    ],
    sections: [
      {
        id: "electrical-work",
        title: "Electrical Scope",
        fields: [
          {
            key: "workTypes",
            label: "Specializations",
            type: "multi_select",
            required: true,
            options: [
              { label: "Ceiling Fan / Exhaust Fan", value: "fans" },
              { label: "Lights & Chandelier Installation", value: "lights" },
              { label: "Switch, Socket & Regulator Fix", value: "switches" },
              { label: "Full House Wiring & Conduit", value: "wiring" },
              { label: "MCB Tripping / Short Circuit Fix", value: "mcb" },
              { label: "Inverter Setup & UPS Wiring", value: "inverter" },
              { label: "Appliance Power Point Setup", value: "power-points" },
            ],
          },
          {
            key: "experienceSector",
            label: "Sectors Covered",
            type: "multi_select",
            required: true,
            options: [
              { label: "Residential (Homes / Flats)", value: "residential" },
              { label: "Commercial (Shops / Offices)", value: "commercial" },
              { label: "Industrial / Workshops", value: "industrial" },
            ],
          },
          {
            key: "trainingCertification",
            label: "Training & Certification",
            type: "single_select",
            required: true,
            options: [
              { label: "ITI Electrician Certificate", value: "iti" },
              { label: "Diploma / Degree in Electrical", value: "diploma" },
              { label: "Wireman License (Government)", value: "licensed-wireman" },
              { label: "Practical Apprenticeship (5+ years)", value: "practical-experience" },
            ],
          },
          {
            key: "ownTools",
            label: "Do you have all professional testing tools & drill machines?",
            type: "toggle",
            required: true,
          },
        ],
      },
    ],
  },

  // 4. Vehicle Services
  "mechanic": {
    categoryId: "mechanic",
    slug: "vehicle-services",
    displayName: "Vehicle Services",
    schemaVersion: 1,
    subcategories: [
      { label: "Bike Repair & Tuning", value: "bike-repair" },
      { label: "Scooter & Activa Repair", value: "scooter-repair" },
      { label: "Car Mechanical Repair", value: "car-repair" },
      { label: "General Periodic Servicing", value: "general-servicing" },
      { label: "Engine & Clutch Overhaul", value: "engine-repair" },
      { label: "Brakes & Suspension", value: "brakes-suspension" },
      { label: "Tyre, Puncture & Wheel Balance", value: "tyres-puncture" },
      { label: "Battery Replacement & Jump Start", value: "battery" },
    ],
    sections: [
      {
        id: "vehicle-scope",
        title: "Vehicle Expertise",
        fields: [
          {
            key: "vehicleType",
            label: "Vehicle Types Handled",
            type: "multi_select",
            required: true,
            options: [
              { label: "2-Wheeler (Bikes, Scooters)", value: "two-wheeler" },
              { label: "4-Wheeler (Hatchback, Sedan, SUV)", value: "four-wheeler" },
              { label: "Auto Rickshaw / 3-Wheeler", value: "three-wheeler" },
            ],
          },
          {
            key: "serviceLocationMode",
            label: "Where do you service?",
            type: "single_select",
            required: true,
            options: [
              { label: "Doorstep / Breakdown Location Only", value: "doorstep" },
              { label: "My Garage / Workshop Only", value: "garage" },
              { label: "Both (Doorstep & Workshop with Pickup)", value: "both" },
            ],
          },
          {
            key: "emergencyBreakdown",
            label: "Breakdown Assistance (Puncture / Jumpstart / Towing)",
            type: "toggle",
            required: false,
          },
        ],
      },
    ],
  },

  // 5. Appliance Repair
  "appliance": {
    categoryId: "appliance",
    slug: "appliance-repair",
    displayName: "Appliance Repair",
    schemaVersion: 1,
    subcategories: [
      { label: "AC Repair & Servicing", value: "ac-repair" },
      { label: "Refrigerator Repair", value: "refrigerator-repair" },
      { label: "Washing Machine Repair", value: "washing-machine-repair" },
      { label: "Television (LED / Smart TV) Repair", value: "tv-repair" },
      { label: "Microwave Oven Repair", value: "microwave-repair" },
      { label: "Water Purifier (RO) Repair", value: "ro-repair" },
      { label: "Geyser / Water Heater Repair", value: "geyser-repair" },
    ],
    sections: [
      {
        id: "appliance-scope",
        title: "Appliances Handled",
        fields: [
          {
            key: "appliancesSupported",
            label: "Supported Appliances",
            type: "multi_select",
            required: true,
            options: [
              { label: "AC (Air Conditioner)", value: "ac" },
              { label: "Refrigerator / Fridge", value: "fridge" },
              { label: "Washing Machine", value: "washing-machine" },
              { label: "Smart TV / LED", value: "tv" },
              { label: "Microwave Oven", value: "microwave" },
              { label: "Geyser / Water Heater", value: "geyser" },
              { label: "RO Water Purifier", value: "ro" },
            ],
          },
          {
            key: "serviceModes",
            label: "Service Modes",
            type: "single_select",
            required: true,
            options: [
              { label: "At customer home", value: "doorstep" },
              { label: "Workshop repair with pickup", value: "workshop" },
              { label: "Both doorstep & workshop", value: "both" },
            ],
          },
          {
            key: "warrantyOffered",
            label: "Do you offer post-service warranty on repairs?",
            type: "single_select",
            required: true,
            options: [
              { label: "30-day repair warranty", value: "30-days" },
              { label: "60-day repair warranty", value: "60-days" },
              { label: "No formal warranty", value: "none" },
            ],
          },
        ],
      },
    ],
  },

  // 6. Carpentry
  "carpenter": {
    categoryId: "carpenter",
    slug: "carpentry",
    displayName: "Carpentry",
    schemaVersion: 1,
    subcategories: [
      { label: "Furniture Repair & Polish", value: "furniture-repair" },
      { label: "Door & Window Fitting", value: "door-fitting" },
      { label: "Cupboard & Wardrobe Work", value: "cupboard-wardrobe" },
      { label: "Modular Kitchen Woodwork", value: "modular-kitchen" },
      { label: "Custom Wood Furniture Making", value: "custom-furniture" },
      { label: "Wall Shelving & TV Units", value: "shelving-units" },
    ],
    sections: [
      {
        id: "carpentry-scope",
        title: "Carpentry Skills",
        fields: [
          {
            key: "workTypes",
            label: "Work Types Handled",
            type: "multi_select",
            required: true,
            options: [
              { label: "Lock & Handle Replacement", value: "locks" },
              { label: "Door Alignment & Planing", value: "doors" },
              { label: "Bed & Table Repair", value: "furniture-repair" },
              { label: "Wardrobe Slider & Hinge Fix", value: "wardrobes" },
              { label: "Custom Furniture Making", value: "custom-making" },
              { label: "Wood Polishing & Varnish", value: "polishing" },
            ],
          },
          {
            key: "homeVisit",
            label: "Work Location",
            type: "single_select",
            required: true,
            options: [
              { label: "At customer home / site", value: "site" },
              { label: "Workshop only", value: "workshop" },
              { label: "Both site visits & workshop", value: "both" },
            ],
          },
        ],
      },
    ],
  },

  // 7. Cleaning & Housekeeping
  "cleaner": {
    categoryId: "cleaner",
    slug: "cleaning-housekeeping",
    displayName: "Cleaning & Housekeeping",
    schemaVersion: 1,
    subcategories: [
      { label: "Regular Home Cleaning", value: "regular-cleaning" },
      { label: "Deep House Cleaning", value: "deep-cleaning" },
      { label: "Bathroom Cleaning", value: "bathroom-cleaning" },
      { label: "Kitchen Deep Cleaning", value: "kitchen-cleaning" },
      { label: "Sofa & Carpet Shampooing", value: "sofa-carpet" },
      { label: "Office & Commercial Cleaning", value: "office-cleaning" },
    ],
    sections: [
      {
        id: "cleaning-details",
        title: "Cleaning Services",
        fields: [
          {
            key: "cleaningTypes",
            label: "Services Offered",
            type: "multi_select",
            required: true,
            options: [
              { label: "Full Home Deep Cleaning", value: "full-home" },
              { label: "Bathroom & Toilet Descaling", value: "bathroom" },
              { label: "Kitchen Chimney & Oil Degreasing", value: "kitchen" },
              { label: "Sofa / Mattress Wet Vacuuming", value: "sofa" },
              { label: "Balcony & Floor Scrubbing", value: "floors" },
            ],
          },
          {
            key: "cleaningSupplies",
            label: "Cleaning Materials & Machines",
            type: "single_select",
            required: true,
            options: [
              { label: "We bring all chemicals & machines", value: "provider-supplies" },
              { label: "Customer provides cleaning supplies", value: "customer-supplies" },
            ],
          },
          {
            key: "crewType",
            label: "Do you work solo or with a team?",
            type: "single_select",
            required: true,
            options: [
              { label: "Solo Cleaner", value: "solo" },
              { label: "2-Person Team", value: "pair" },
              { label: "Large Crew (3+ Workers)", value: "crew" },
            ],
          },
        ],
      },
    ],
  },

  // 8. Beauty & Personal Care
  "beauty-service": {
    categoryId: "beauty-service",
    slug: "beauty-personal-care",
    displayName: "Beauty & Personal Care",
    schemaVersion: 1,
    subcategories: [
      { label: "Haircut & Styling", value: "haircut" },
      { label: "Makeup & Hairstyling", value: "makeup" },
      { label: "Bridal Makeup & Mehendi", value: "bridal" },
      { label: "Facial & Skin Care", value: "facial" },
      { label: "Waxing & Threading", value: "waxing-threading" },
      { label: "Men's Grooming & Shaving", value: "mens-grooming" },
    ],
    sections: [
      {
        id: "beauty-scope",
        title: "Beauty & Salon Services",
        fields: [
          {
            key: "serviceTarget",
            label: "Client Target",
            type: "single_select",
            required: true,
            options: [
              { label: "Women Only", value: "women" },
              { label: "Men Only", value: "men" },
              { label: "Unisex (All Clients)", value: "unisex" },
            ],
          },
          {
            key: "serviceVenue",
            label: "Service Location",
            type: "single_select",
            required: true,
            options: [
              { label: "At client's home (Doorstep Salon)", value: "home" },
              { label: "At my salon / studio", value: "salon" },
              { label: "Both doorstep & salon", value: "both" },
            ],
          },
          {
            key: "productsBrand",
            label: "Do you use premium branded salon products?",
            type: "toggle",
            required: true,
          },
        ],
      },
    ],
  },

  // 9. Construction & Renovation
  "painter": {
    categoryId: "painter",
    slug: "painting-renovation",
    displayName: "Painting & Renovation",
    schemaVersion: 1,
    subcategories: [
      { label: "Interior House Painting", value: "interior-painting" },
      { label: "Exterior Weatherproof Painting", value: "exterior-painting" },
      { label: "Wall Putty & Primer Finishing", value: "putty-primer" },
      { label: "Wall Texture & Designer Stencils", value: "wall-texture" },
      { label: "Waterproofing & Seepage Fix", value: "waterproofing" },
      { label: "Tile & Flooring Work", value: "tiles" },
    ],
    sections: [
      {
        id: "painting-details",
        title: "Painting & Masonry Scope",
        fields: [
          {
            key: "paintingSpecialties",
            label: "Specialties",
            type: "multi_select",
            required: true,
            options: [
              { label: "1BHK / 2BHK / 3BHK Full Repainting", value: "full-home" },
              { label: "Single Room / Touch-up Painting", value: "touchup" },
              { label: "Waterproofing & Wall Crack Filling", value: "waterproofing" },
              { label: "Texture & Royal Play Stencils", value: "designer" },
              { label: "Wood & Metal Enamel Painting", value: "enamel" },
            ],
          },
          {
            key: "measurementMethod",
            label: "Estimation Method",
            type: "single_select",
            required: true,
            options: [
              { label: "Per Sq. Ft. Rate", value: "per-sqft" },
              { label: "Fixed Job / Lump Sum Contract", value: "lump-sum" },
              { label: "Daily Wage / Per Day Painter", value: "daily" },
            ],
          },
        ],
      },
    ],
  },

  // 10. Cooking & Catering
  "food-catering": {
    categoryId: "food-catering",
    slug: "cooking-catering",
    displayName: "Cooking & Catering",
    schemaVersion: 1,
    subcategories: [
      { label: "Daily Home Cook", value: "daily-cook" },
      { label: "Party & Event Catering", value: "catering" },
      { label: "Daily Tiffin Service", value: "tiffin" },
      { label: "Personal Chef", value: "personal-chef" },
      { label: "Baking & Custom Cakes", value: "baking" },
    ],
    sections: [
      {
        id: "cooking-details",
        title: "Cuisine & Meal Details",
        fields: [
          {
            key: "foodPreferences",
            label: "Dietary Offerings",
            type: "single_select",
            required: true,
            options: [
              { label: "Pure Vegetarian Only", value: "pure-veg" },
              { label: "Non-Vegetarian & Vegetarian", value: "both" },
            ],
          },
          {
            key: "cuisineTypes",
            label: "Cuisines Cooked",
            type: "multi_select",
            required: true,
            options: [
              { label: "South Indian (Telugu, Tamil, etc.)", value: "south-indian" },
              { label: "North Indian (Rotis, Curries, Dals)", value: "north-indian" },
              { label: "Chinese & Snacks", value: "chinese" },
              { label: "Hyderabadi Biryani & Traditional", value: "biryani" },
            ],
          },
          {
            key: "workArrangement",
            label: "Arrangement",
            type: "single_select",
            required: true,
            options: [
              { label: "Cook at client home (Daily / Part-time)", value: "client-home" },
              { label: "Cook at own kitchen & deliver (Tiffin / Catering)", value: "tiffin-delivery" },
            ],
          },
        ],
      },
    ],
  },

  // 11. Computer & Technology
  "computer-repair": {
    categoryId: "computer-repair",
    slug: "computer-technology",
    displayName: "Computer & Technology",
    schemaVersion: 1,
    subcategories: [
      { label: "Laptop Hardware Repair", value: "laptop-hardware" },
      { label: "Desktop PC Assembling & Repair", value: "desktop-repair" },
      { label: "Windows / Mac OS Installation", value: "os-software" },
      { label: "Virus Removal & System Tune-up", value: "virus-cleanup" },
      { label: "Data Recovery & Backup", value: "data-recovery" },
      { label: "Wi-Fi & Home Networking Setup", value: "networking" },
      { label: "Printer & Scanner Service", value: "printer" },
    ],
    sections: [
      {
        id: "tech-skills",
        title: "Technology Scope",
        fields: [
          {
            key: "deviceExpertise",
            label: "Devices Handled",
            type: "multi_select",
            required: true,
            options: [
              { label: "Windows Laptops (Dell, HP, Lenovo, etc.)", value: "windows-laptops" },
              { label: "Apple MacBooks / iMacs", value: "macbooks" },
              { label: "Custom Gaming & Office Desktops", value: "desktops" },
              { label: "Printers & CCTV Routers", value: "peripherals" },
            ],
          },
          {
            key: "serviceVenue",
            label: "Service Location",
            type: "single_select",
            required: true,
            options: [
              { label: "Doorstep Visit & Repair", value: "doorstep" },
              { label: "Workshop Repair (With Pickup & Drop)", value: "workshop" },
              { label: "Remote Support (AnyDesk / TeamViewer)", value: "remote" },
            ],
          },
        ],
      },
    ],
  },

  // 12. Mobile Repair
  "mobile-repair": {
    categoryId: "mobile-repair",
    slug: "mobile-repair",
    displayName: "Mobile Repair",
    schemaVersion: 1,
    subcategories: [
      { label: "Screen & Display Replacement", value: "screen" },
      { label: "Battery Replacement", value: "battery" },
      { label: "Charging Port & Mic Repair", value: "charging-port" },
      { label: "Camera & Speaker Fix", value: "camera-speaker" },
      { label: "Water Damage Motherboard Repair", value: "water-damage" },
      { label: "Software Flashing & Unlock", value: "software" },
    ],
    sections: [
      {
        id: "mobile-scope",
        title: "Phone Repair Details",
        fields: [
          {
            key: "brandsSupported",
            label: "Brands Serviced",
            type: "multi_select",
            required: true,
            options: [
              { label: "Apple iPhone", value: "apple" },
              { label: "Samsung", value: "samsung" },
              { label: "Xiaomi / Redmi / Poco", value: "xiaomi" },
              { label: "Realme / Oppo / Vivo", value: "oppo-vivo" },
              { label: "OnePlus", value: "oneplus" },
              { label: "All Android Devices", value: "all-android" },
            ],
          },
          {
            key: "doorstepOption",
            label: "Do you perform instant screen / battery replacement at customer doorstep?",
            type: "toggle",
            required: true,
          },
        ],
      },
    ],
  },

  // 13. Gardening & Outdoor
  "gardener": {
    categoryId: "gardener",
    slug: "gardening-outdoor",
    displayName: "Gardening & Outdoor",
    schemaVersion: 1,
    subcategories: [
      { label: "Lawn Mowing & Weeding", value: "lawn-mowing" },
      { label: "Plant Maintenance & Pruning", value: "plant-care" },
      { label: "Terrace Garden Setup", value: "terrace-garden" },
      { label: "Soil & Organic Fertilizer Supply", value: "fertilizer" },
      { label: "Tree Trimming & Removal", value: "tree-trimming" },
    ],
    sections: [
      {
        id: "gardening-scope",
        title: "Gardening Services",
        fields: [
          {
            key: "gardenTypes",
            label: "Garden Types Handled",
            type: "multi_select",
            required: true,
            options: [
              { label: "Terrace & Balcony Pots", value: "balcony" },
              { label: "Villa / Independent House Lawns", value: "lawns" },
              { label: "Apartment Gated Community Grounds", value: "community" },
            ],
          },
          {
            key: "frequencyOptions",
            label: "Available Booking Modes",
            type: "multi_select",
            required: true,
            options: [
              { label: "One-Time Cleanup & Setup", value: "one-time" },
              { label: "Weekly / Monthly Maintenance Contract", value: "recurring" },
            ],
          },
        ],
      },
    ],
  },

  // 14. Driving & Transit
  "driver": {
    categoryId: "driver",
    slug: "driving-transit",
    displayName: "Driving & Transit",
    schemaVersion: 1,
    subcategories: [
      { label: "Personal Car Driver (Local City)", value: "local-driver" },
      { label: "Outstation Trip Driver", value: "outstation-driver" },
      { label: "Monthly Contract Driver", value: "monthly-driver" },
      { label: "School Cab / Transport", value: "school-cab" },
      { label: "Night Shift Driver", value: "night-driver" },
    ],
    sections: [
      {
        id: "driver-details",
        title: "Driving Credentials",
        fields: [
          {
            key: "licenseType",
            label: "Driving License Category",
            type: "single_select",
            required: true,
            options: [
              { label: "LMV (Light Motor Vehicle - Car / Jeep)", value: "lmv" },
              { label: "Commercial Transport License (Yellow Badge)", value: "commercial" },
              { label: "Heavy Vehicle (HMV / Bus / Truck)", value: "hmv" },
            ],
          },
          {
            key: "transmissionType",
            label: "Gearbox Expertise",
            type: "single_select",
            required: true,
            options: [
              { label: "Both Manual & Automatic Cars", value: "both" },
              { label: "Manual Cars Only", value: "manual" },
              { label: "Automatic Cars Only", value: "automatic" },
            ],
          },
          {
            key: "drivingHistory",
            label: "Years of Active Driving Experience",
            type: "number",
            required: true,
            min: 1,
            max: 50,
          },
        ],
      },
    ],
  },

  // 15. Security & CCTV
  "security": {
    categoryId: "security",
    slug: "security-cctv",
    displayName: "Security & CCTV",
    schemaVersion: 1,
    subcategories: [
      { label: "CCTV Camera Installation", value: "cctv-install" },
      { label: "CCTV Repair & DVR Troubleshooting", value: "cctv-repair" },
      { label: "Home Security & Smart Locks", value: "smart-locks" },
      { label: "Residential Security Guard", value: "guard-service" },
      { label: "Night Watchman Service", value: "night-watchman" },
    ],
    sections: [
      {
        id: "security-scope",
        title: "Security & Surveillance Scope",
        fields: [
          {
            key: "cctvBrands",
            label: "CCTV Systems Installed",
            type: "multi_select",
            required: true,
            options: [
              { label: "CP Plus", value: "cp-plus" },
              { label: "Hikvision", value: "hikvision" },
              { label: "Dahua", value: "dahua" },
              { label: "Wi-Fi 360 Smart Cameras", value: "smart-wifi" },
            ],
          },
          {
            key: "serviceVenue",
            label: "Target Properties",
            type: "multi_select",
            required: true,
            options: [
              { label: "Homes & Apartments", value: "residential" },
              { label: "Shops & Commercial Stores", value: "commercial" },
              { label: "Warehouses & Factories", value: "industrial" },
            ],
          },
        ],
      },
    ],
  },

  // 16. Other Services
  "other": {
    categoryId: "other",
    slug: "other-services",
    displayName: "Other Services",
    schemaVersion: 1,
    subcategories: [
      { label: "Custom Specialist Service", value: "custom-service" },
      { label: "Unique Local Skill", value: "unique-skill" },
    ],
    sections: [
      {
        id: "custom-details",
        title: "Service Description & Scope",
        fields: [
          {
            key: "serviceTitle",
            label: "Exact Service Name",
            type: "text",
            required: true,
            placeholder: "e.g. Aquarium Cleaning, Bookbinding, Leather Repair",
          },
          {
            key: "workScope",
            label: "What work do you perform?",
            type: "textarea",
            required: true,
            placeholder: "Describe the tasks, tools, and materials involved in your service.",
          },
          {
            key: "targetCustomer",
            label: "Target Customer",
            type: "single_select",
            required: true,
            options: [
              { label: "Residential / Homeowners", value: "residential" },
              { label: "Commercial / Businesses", value: "commercial" },
              { label: "Anyone", value: "anyone" },
            ],
          },
          {
            key: "serviceMode",
            label: "Service Location",
            type: "single_select",
            required: true,
            options: [
              { label: "At customer location", value: "doorstep" },
              { label: "At my workshop / center", value: "center" },
              { label: "Online / Remote", value: "remote" },
            ],
          },
        ],
      },
    ],
  },
};
