create, update, or confirm all the necessary queries that mimic the server.mjs data to have this data or information filled and shown in the frontend of the client home page and the admin dashboard:

queries and information neede for a specific client's home page (uses the capstone2026 database):
- account cash balance
- total portfolio value
- total return
- line graph of portfolio performance (invested capital over time through filled orders)
- buying power, cash (same as buying power), holdings value (same as total portfolio value), total account value (cash + holdings value)
- current holdings (valued at the latest price the platform holds for each instrument)
- recent orders placed 

queries and information needed for admin's dashboard:
- platform over (use data_warehouse as the database for this):
	- number of registered clients (client records on the platform)
	- number of accounts with cash (clients with a positive cash balance)
	- total client cash (sum of all client cash balances)
	- number of tradable instruments
	number of all total admins (separately, include how many admins there are based on each role)
- trading operations (use the capstone2026 database for this)
	- client activity lookup (search a client based on id or email)
	- order lookup (trace an order using order id)
	- list of market data health based on all, fresh, stale, no quote , and not tradable status (orders that are priced only against quotes under 30s old; shows number of fresh, stale, and without a quote states)
- financial operations (use capstone2026 database for this):
	- client cash positions (should be able to search up a name or email or filter based on highest balance, name from A-Z, and newest clients)
- administrative management
	- shows list of administrators and their role
	- can search up based on name or email
	- can filter based on role
	- there should be the ability to add a new administrator (needs first name, last name, email address, temp password, and assigned role)




-----------------------------------------------------------------------------------------------------------------------------------------------------------------------
Add a deafult landing page with the new nav bar at the top, instead of the user in the top right corner, have the login and the sign up buttom so for the users. When sign up is clicked the user will go to registeration page, when login is clicked the user woll go to login page. THe landing page should display our logo and have a description  of our trading polatform with snippets of the actions that can be done via our app. THe landing page should be an informative overview inviting users to use oit tradig platform.
