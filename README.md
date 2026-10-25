# Welcome!

This is a website dedicated to Blitz, the STEM Racing team, wholly developed by Chen.
On this website, you will find:
- A homepage with introduction and summary of what STEM Racing is and who we are.
- Outline of our awards and achievements
- Introduction of each team member
- Exploration of our journey
- A sponsorship prospectus for prospectus sponsors
- A place for new teams to gain inspiration through our previous cars.

Please contact us if you have any sponsorship enquiries via the email on our prospectus (found on the contact us page).

## 25/10/2026 Update
- There is now a portal on the site.
- This is designed to be used only for team members, for car development to be organised and managed amongst the team. It allows for car files and designs to be shared amongst team members (to fix the messy "can you send me this" we do on WhatsApp), as well as test data so that it's easier to collaborate and see each others' designs.
- Right now, there is only UI and an authentication system.
- The API is running off Cloudflare Workers, and the database is running off Cloudflare D1.
- The authentication system verifies passwords by hashing - the key derivation algorithm used is PBKDF2 on a SHA-512 hash function. (maybe I'll upgrade it to Argon2, but it depends if it is too CPU-expensive)
- If you want to try the login system, see the ship's description for sample login details. It doesn't do much, it only acknowledges that there has been a successful login made.
- I have started a little bit on the session token cookie system - this will be stored on Cloudflare D1 too.
- The plan is to either encrypt or hash this, I am working to verify session tokens by comparing a cookie to the one in the database etc.
- The frontend hasn't been updated at all for session tokens, but it's kinda useless right now anyway so it's fineee