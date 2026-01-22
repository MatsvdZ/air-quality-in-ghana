# air quality in Ghana
A web-based platform that visualizes nitrogen dioxide (NO₂) air quality measurements in Kumasi, Ghana.
The portal is designed to support public awareness and scientific research, with a strong focus on mobile-first design, low data usage, and data transparency.

🔗 Live site: https://air-quality-in-ghana-production.up.railway.app/


## Project overview
This platform presents monthly NO₂ measurements collected using low-cost diffusion tubes at street level.
Users can explore the data through an interactive map and table view, download datasets, and compare locations over time.

In addition, a protected admin environment allows researchers to manage locations and measurements without modifying the codebase.

## Key features
### User
	•	Interactive map with measurement points (Leaflet)
	•	Time slider to explore historical data (monthly)
	•	Table view with filtering (period, value range, search)
	•	Download options (JSON / Excel)
	•	Ranking of best-performing locations
	•	Mobile-first and low-bandwidth friendly

### Admin
	•	Secure login
	•	Add, edit and delete locations
	•	Add, edit and delete measurements
	•	Search, filter and paginate measurements
	•	Designed for researchers and lab staff

## Tech stack
### Frontend
	•	EJS – server-side templating
	•	Vanilla JavaScript – client-side logic
	•	CSS (mobile-first) – custom styling, no UI framework
	•	Leaflet.js – interactive map using OpenStreetMap tiles

### Backend
	•	Node.js
	•	Express.js – web server & routing
	•	MongoDB – database
	•	Mongoose – object data modeling (ODM)

### Data & utilities
	•	ExcelJS – importing and exporting Excel files
	•	dotenv – environment variable management
	•	express-session – authentication sessions
	•	connect-mongo – session storage in MongoDB

## Installation & setup
1. Clone the repository
   `git clone https://github.com/MatsvdZ/air-quality-in-ghana.git`

2. Install dependencies
   `npm install`

3. Environment variables

   Create a .env file in the project root:
   
   ```
   PORT=3000
   MONGODB_URI=mongodb://localhost:27017/airquality
   SESSION_SECRET=your-secret-key
   ADMIN_USERNAME=admin
   ADMIN_PASSWORD=strong-password
   ```

4. Import data (Excel -> MongoDB

   Place your Excel file here:
   
   `src/scripts/data/source/latest.xlsx`

   Run the import script:

   `node src/scripts/importExcelToMongo.js`

   The script:
```
•	reads measurements and locations from the Excel file
•	normalizes column headers
•	clears old data (optional)
•	inserts clean, structured documents into MongoDB
```

5. Start the server

   `npm start`

   The application will run at:

   `http://localhost:3000`

## Data handling & design choices
### Data structure
	•	Locations and Measurements are stored in separate collections
	•	Measurements reference locations using locationId
	•	Measurement periods are standardized as YYYY-MM

### Why point-based mapping?
	•	Data is only shown where measurements exist
	•	No interpolation or heatmaps are used
	•	Prevents misleading conclusions in unmeasured areas   

### Performance considerations 
	•	No satellite tiles or heavy map layers
	•	Vector-based markers
	•	Limited API payloads
	•	Designed for low-bandwidth mobile networks  

## Authors

This project was developed as part of a school collaboration with KNMI in the Netherlands and KNUST in Ghana.

	•	Esmae Grapendaal
	•	Mats van der Zwan
	•	Vera Hendriks  

## License

This project is for educational and research purposes.
All air quality data remains the property of the project partners.  
