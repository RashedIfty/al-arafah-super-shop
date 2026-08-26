/* ==========================================================================
   ★★★  ADMIN — EDIT THIS FILE  ★★★
   ==========================================================================
   This is the ONLY file you need to touch to update the banner at the top
   of the website. Save the file and refresh the page — the change is live.

   ------------------------------------------------------------------------
   HOW TO ADD AN ITEM
   ------------------------------------------------------------------------
   Copy one block, paste it, and change the words. Keep the commas.

     {
       type : "new",                                  // "new" or "deal"
       en   : "Beef with Bone",                           // English name
       bn   : "হাড়সহ গরুর মাংস",                        // Bangla name
       ja   : "骨付き牛肉",                             // Japanese name
       w    : "1 kg",                                 // weight / size
       p    : 1920,                                   // price now (yen)
       was  : 2180,                                   // old price, or 0
       img  : "assets/img/products/beef-bone.jpg"     // product photo
     },

   type "new"   → green NEW badge      (newly arrived stock)
   type "deal"  → red TODAY'S DEAL badge (special price today)

   img: point it at any file in assets/img/products/ — the same photo the
        product card uses. Leave it "" to fall back to the shop placeholder.

   was: 0   → no discount shown
   was: 2180 → shows ¥2,180 struck through + the % saved

   ------------------------------------------------------------------------
   TO HIDE THE WHOLE BANNER
   ------------------------------------------------------------------------
   Set  ACTIVE: false  below.

   ------------------------------------------------------------------------
   TO REMOVE ONE ITEM
   ------------------------------------------------------------------------
   Delete its block (from the "{" to the "}," inclusive).
   ========================================================================== */

const DEFAULT_ANNOUNCEMENTS = {

  /* Turn the whole top banner on/off */
  ACTIVE: true,

  /* Date shown next to the heading — free text, write it however you like. */
  updated: {
    en: "Updated today",
    bn: "আজ আপডেট করা হয়েছে",
    ja: "本日更新"
  },

  /* ----------------------------------------------------------------------
     THE ITEMS — edit, add or delete below
     ---------------------------------------------------------------------- */
  items: [

    {
      type : "new",
      en   : "Beef with Bone",
      bn   : "হাড়সহ গরুর মাংস",
      ja   : "骨付き牛肉",
      w    : "1 kg",
      p    : 1920,
      was  : 2180,
      img  : "assets/img/products/beef-bone.jpg"
    },

    {
      type : "deal",
      en   : "Tilapia Whole Frozen",
      bn   : "তেলাপিয়া মাছ",
      ja   : "ティラピア（冷凍）",
      w    : "800 g",
      p    : 398,
      was  : 440,
      img  : "assets/img/products/tilapia.jpg"
    },

    {
      type : "new",
      en   : "Mutton Curry Cut",
      bn   : "খাসির মাংস",
      ja   : "マトン（カレー用）",
      w    : "1 kg",
      p    : 3480,
      was  : 0,
      img  : "assets/img/products/mutton.jpg"
    },

    {
      type : "new",
      en   : "Prawn / Shrimp Medium",
      bn   : "চিংড়ি (মাঝারি)",
      ja   : "エビ（中）",
      w    : "500 g",
      p    : 1480,
      was  : 0,
      img  : "assets/img/products/prawn.jpg"
    },

    {
      type : "deal",
      en   : "Masoor Dal (Red Lentil)",
      bn   : "মসুর ডাল",
      ja   : "レンズ豆（マスール）",
      w    : "1 kg",
      p    : 261,
      was  : 394,
      img  : "assets/img/products/masoor-dal.jpg"
    },

    {
      type : "deal",
      en   : "Premium Basmati Rice",
      bn   : "প্রিমিয়াম বাসমতি চাল",
      ja   : "高級バスマティ米",
      w    : "5 kg",
      p    : 3690,
      was  : 4280,
      img  : "assets/img/products/basmati-premium.jpg"
    }

  ]
};

/** Edits made in the admin panel override the defaults above. */
function withLocalDeals(){
  try {
    const raw = localStorage.getItem("aa-deals");
    if (raw) {
      const items = JSON.parse(raw);
      if (Array.isArray(items)) return { ...DEFAULT_ANNOUNCEMENTS, items };
    }
  } catch { /* unavailable or corrupt — use defaults */ }
  return DEFAULT_ANNOUNCEMENTS;
}

export const ANNOUNCEMENTS = withLocalDeals();
export { DEFAULT_ANNOUNCEMENTS };
