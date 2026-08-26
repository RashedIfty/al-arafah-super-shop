# Al-Arafah Super Shop

Trilingual (বাংলা · English · 日本語) storefront for Al-Arafah Super Shop, Tsukuba, Japan.

## Run

ES modules need HTTP — opening `index.html` directly will not work.

```bash
python3 -m http.server 8080
# then open http://localhost:8080
```

## Structure

```
index.html  products.html  about.html  contact.html
assets/
├── css/
│   ├── main.css              entry point (@imports everything below)
│   ├── base/                 tokens · reset · utilities · responsive
│   ├── layout/               header · nav · hero · footer · pages
│   └── components/           button · chips · card · promo
├── js/
│   ├── app.js                entry point — mounts and re-renders
│   ├── core/                 dom · lang · format
│   ├── components/           chrome · product-card · search
│   └── data/                 catalog · shop · i18n(.en|.bn|.ja)
└── img/
    ├── logo.jpeg
    ├── placeholder.svg       stands in for missing product photos
    └── products/             put real product photos here
```

## ★ Updating "Today's Deal & New Arrival" (shop admin)

The banner at the top of every page is driven by **one file**:

```
assets/js/data/announcements.js
```

Open it, edit, save, refresh the browser. Nothing else to touch.

**Add an item** — copy a block and change the words:

```js
{
  type : "new",              // "new" = green NEW ARRIVAL badge
                             // "deal" = gold TODAY'S DEAL badge
  en   : "Fresh Beef",
  bn   : "তাজা গরুর মাংস",
  ja   : "新鮮な牛肉",
  w    : "1 kg",             // weight / size
  p    : 1920,               // price today
  was  : 2180,               // old price — use 0 for no discount
  img  : "assets/img/products/beef-bone.jpg"   // product photo
},
```

- `was: 2180` shows the old price struck through plus a red `-12%` badge.
- `was: 0` shows just the price.
- **Remove an item** — delete its block from `{` to `},`.
- **Hide the whole banner** — set `ACTIVE: false` at the top of the file.
- Tapping any item opens the photo large in a lightbox.

## Adding a product

Edit `assets/js/data/catalog.js`:

```js
{ en:"Basmati Rice", bn:"বাসমতি চাল", ja:"バスマティ米",
  w:"5 kg", p:3890, was:4280, img:"assets/img/products/rice.jpg" }
```

| field | meaning |
|-------|---------|
| `en` / `bn` / `ja` | name in each language (all three required) |
| `w`   | weight or size shown on the card |
| `p`   | price in yen |
| `was` | old price — `0` means not on sale (drives the `-%` badge) |
| `img` | photo path — `""` falls back to the placeholder |
| `tag` | `"new"`, `"out"`, or omit |

## Adding category photos

Each category shows a large tile photo plus a small sidebar thumbnail — both
read the same file. Replace the placeholder in `assets/img/categories/`:

```
assets/img/categories/meat.svg   →   assets/img/categories/meat.jpg
```

then update the path in `assets/js/data/catalog.js`:

```js
{ id:"meat", icon:"🥩", img:"assets/img/categories/meat.jpg", ... }
```

Square images (1:1) work best — a group shot of the products in that
category, roughly 400×400 or larger.

## Adding product photos

Drop files into `assets/img/products/`, then set `img:` on the matching item.
Square images (1:1) work best; ~600×600 is plenty.

## Adding a language

1. Copy `assets/js/data/i18n.en.js` to `i18n.<code>.js` and translate the values.
2. Register it in `assets/js/data/i18n.js`.
3. Add the matching key to every product and category in `catalog.js`.

## Notes

- Product names and prices are placeholders — replace with real stock.
- Language choice persists in `localStorage`; falls back to browser language.
