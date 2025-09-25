# SparkleWash Car Wash Management System

A comprehensive car wash service management system with separate interfaces for administrators and washers, built with React.js frontend and Node.js backend.

## 🚀 Features Implemented

### Admin Dashboard Features
- ✅ **Customer Management**: Complete CRUD operations for customers
- ✅ **Package Management**: Basic, Moderate, and Classic wash packages
- ✅ **User Interface**: Mobile-responsive design with Tailwind CSS
- ✅ **Context Menu**: Right-click functionality for customer operations
- ✅ **Customer History**: View wash history by month with detailed logs
- ✅ **Delete Confirmation**: Safe deletion with confirmation modal
- ✅ **Search & Filters**: Filter by package, car model, and apartment
- ✅ **Pagination**: Efficient data loading with smart pagination

### Washer Mobile Interface Features
- ✅ **Washer Authentication**: Login with Washer ID and Email
- ✅ **Mobile Dashboard**: Responsive design optimized for mobile devices
- ✅ **Customer Assignments**: View assigned customers with wash counts
- ✅ **Work Tracking**: Track pending and completed washes
- ✅ **Location Display**: Show customer apartment and location details

### Backend API Features
- ✅ **RESTful APIs**: Complete CRUD operations
- ✅ **Database Integration**: MongoDB with Mongoose ODM
- ✅ **Wash Count Calculations**: Automatic pending/completed wash tracking
- ✅ **Authentication System**: Washer verification system
- ✅ **Error Handling**: Comprehensive error responses
- ✅ **Data Validation**: Input validation and sanitization

## 🛠️ Technical Stack

### Frontend
- **Framework**: React.js with Vite
- **Styling**: Tailwind CSS
- **Icons**: Heroicons React
- **Routing**: React Router DOM
- **State Management**: React Hooks (useState, useEffect)

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Validation**: Built-in validation with error handling

## 📦 Project Structure

```
sparklewash-server/
├── Controller/
│   ├── CustomerController.js    # Customer CRUD operations
│   ├── WasherController.js      # Washer authentication & dashboard
│   ├── PackageController.js     # Package management
│   └── ...
├── models/
│   ├── Customer.js             # Customer schema
│   ├── Washer.js              # Washer schema
│   ├── Package.js             # Package schema
│   ├── WashLog.js             # Wash history tracking
│   └── ...
├── routes/
│   ├── CustomerRoutes.js       # Customer API endpoints
│   ├── WasherRoutes.js        # Washer API endpoints
│   └── ...
└── index.js                   # Main server file

sparkle-wash/
├── src/
│   ├── components/
│   │   ├── Usermanagement.jsx      # Admin customer management
│   │   ├── WasherAuth.jsx          # Washer login page
│   │   ├── WasherDashboard.jsx     # Washer mobile dashboard
│   │   ├── ContextMenu.jsx         # Right-click context menu
│   │   ├── CustomerHistoryModal.jsx # Wash history viewer
│   │   ├── DeleteConfirmationModal.jsx # Delete confirmation
│   │   ├── AddCustomerModal.jsx    # Add new customer
│   │   └── Sidebar.jsx            # Navigation sidebar
│   ├── pages/
│   └── App.jsx
└── package.json
```

## 🔧 Setup Instructions

### Prerequisites
- Node.js (v14 or higher)
- MongoDB (running on localhost:27017)
- npm or yarn package manager

### Backend Setup
1. **Navigate to backend directory**:
   ```powershell
   cd "d:\server\sparklewash-server"
   ```

2. **Install dependencies**:
   ```powershell
   npm install
   ```

3. **Start MongoDB** (ensure it's running on localhost:27017)

4. **Start the backend server**:
   ```powershell
   npm start
   ```
   Server will run on `http://localhost:5000`

### Frontend Setup
1. **Navigate to frontend directory**:
   ```powershell
   cd "d:\server\sparkle-wash"
   ```

2. **Install dependencies**:
   ```powershell
   npm install
   ```

3. **Start the development server**:
   ```powershell
   npm run dev
   ```
   Application will run on `http://localhost:5174`

## 📱 Usage Guide

### Admin Interface
1. **Access Admin Dashboard**: Navigate to `http://localhost:5174`
2. **Customer Management**: 
   - Click "Add New Customer" to create customers
   - Right-click on any customer row to access context menu
   - View history, edit, or delete customers
3. **Search & Filter**: Use search bar and filters to find specific customers
4. **Pagination**: Navigate through customer lists with pagination controls

### Washer Interface
1. **Access Washer Login**: Navigate to `http://localhost:5174/washer`
2. **Login**: Enter Washer ID and Email to authenticate
3. **Dashboard**: View assigned customers and wash counts
4. **Mobile Optimized**: Interface designed for mobile devices

### Context Menu Operations
- **Right-click** on any customer row to access:
  - 📋 **View History**: See detailed wash logs by month
  - ✏️ **Edit Customer**: Modify customer information
  - 🗑️ **Delete Customer**: Remove customer (with confirmation)

## 🗄️ Database Schema

### Customer Model
```javascript
{
  name: String,
  mobileNo: String,
  email: String,
  apartment: String,
  doorNo: String,
  carModel: String,
  vehicleNo: String,
  packageId: ObjectId,
  packageName: String,
  washerId: ObjectId (optional),
  subscriptionStart: Date,
  subscriptionEnd: Date,
  status: String
}
```

### Package Model
```javascript
{
  name: String,
  pricePerMonth: Number,
  washCountPerWeek: Number,
  interiorCleaning: Boolean,
  exteriorWaxing: Boolean,
  description: String
}
```

### Washer Model
```javascript
{
  name: String,
  email: String,
  mobileNo: String,
  assignedApartments: [String],
  currentLocation: String,
  isAvailable: Boolean,
  status: String,
  totalWashesCompleted: Number
}
```

### WashLog Model
```javascript
{
  customerId: ObjectId,
  washerId: ObjectId,
  washDate: Date,
  washType: String,
  status: String,
  location: String,
  notes: String
}
```

## 🌐 API Endpoints

### Customer APIs
- `GET /api/customer/getcustomers` - Get all customers with wash counts
- `GET /api/customer/:id` - Get single customer
- `POST /api/customer/add` - Add new customer
- `DELETE /api/customer/deletecustomer/:id` - Delete customer
- `GET /api/customer/:id/wash-history` - Get customer wash history

### Washer APIs
- `POST /api/washer/authenticate` - Authenticate washer
- `GET /api/washer/dashboard/:washerId` - Get washer dashboard data
- `POST /api/washer/complete-wash` - Mark wash as completed

### Package APIs
- `GET /api/package/getpackages` - Get all packages

## 🎯 Key Features Explained

### 1. Context Menu System
- **Right-click functionality** on customer rows
- **Dynamic positioning** based on click coordinates
- **Customer-specific actions** with data passing
- **Backdrop close** for better UX

### 2. Wash Count Calculation
- **Automatic calculation** of pending vs completed washes
- **Monthly tracking** based on package wash limits
- **Real-time updates** when washes are completed

### 3. Mobile-Responsive Washer Interface
- **Touch-friendly design** for mobile devices
- **Card-based layout** for easy customer browsing
- **Essential information** display for washers
- **Work completion tracking**

### 4. Advanced Customer Management
- **Multi-criteria search** (name, phone, email, vehicle)
- **Dynamic filtering** by package, car model, apartment
- **Smart pagination** with page number display
- **Bulk operations** support

## 🔐 Security Features
- **Input validation** on all API endpoints
- **ObjectId validation** for database queries
- **Error handling** with appropriate HTTP status codes
- **Data sanitization** before database operations

## 🚧 Future Enhancements
- [ ] **Customer Edit Interface**: Complete edit functionality with modal
- [ ] **Advanced Reporting**: Generate wash completion reports
- [ ] **Real-time Notifications**: WebSocket integration for live updates
- [ ] **GPS Tracking**: Location tracking for washers
- [ ] **Payment Integration**: Handle subscription payments
- [ ] **SMS/Email Notifications**: Customer communication system

## 🐛 Known Issues Fixed
- ✅ **PowerShell Execution Policy**: Fixed with RemoteSigned policy
- ✅ **MongoDB Connection**: Resolved connection string issues
- ✅ **500 Internal Server Error**: Fixed washerId casting to ObjectId
- ✅ **Package Field Mismatch**: Aligned frontend/backend field names
- ✅ **Context Menu Positioning**: Fixed positioning and backdrop close

## 📞 Support
For technical support or feature requests, please refer to the codebase documentation or contact the development team.

---
**SparkleWash Management System v1.0** - Built with ❤️ using React.js and Node.js