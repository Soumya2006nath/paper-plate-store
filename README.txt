NABANITA GROUP - Paper Plate Store website - how to run
==============================
1. Install Node.js (free): https://nodejs.org  (version 16 or newer)
2. Unzip this folder.
3. Open a terminal / Command Prompt inside the folder and run:
       node server.js
   (Windows: set password first -> set ADMIN_PASSWORD=mypass && node server.js
    Mac/Linux:                    -> ADMIN_PASSWORD=mypass node server.js)
4. Open in browser:
       Store (customers):  http://localhost:3000
       Admin (you):        http://localhost:3000/admin
   Default admin password: admin123  (CHANGE IT as shown above)

Admin: add / edit / delete items (photo, name, price, per qty) and see customer enquiries.
Customers: tap Enquire, enter name + phone, WhatsApp opens to your number with the message ready.

Change WhatsApp number: edit WHATSAPP_NUMBER at the top of the script in public/index.html.
Change currency: edit CURRENCY in public/index.html (and the ₹ in public/admin.html).
Your data is saved in the "data" folder and photos in "uploads" - back them up.

To put it online for everyone: upload this folder to any Node host (Render, Railway, a VPS)
and set the ADMIN_PASSWORD environment variable. Start command: node server.js

DEPLOY ON A FREE ORACLE CLOUD SERVER
------------------------------------
See DEPLOY.txt (step by step). In short: create a free Ubuntu VM, open ports 80/443
in Oracle's network settings, upload this folder, then run:  bash setup.sh
