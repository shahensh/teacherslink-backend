# Teachers Link Backend API

A comprehensive backend API for the Teachers Link platform - connecting schools and teachers.

## Features

- **Authentication & Authorization**: JWT-based auth with role-based access control
- **User Management**: Separate profiles for teachers and schools
- **Job Management**: Post, search, and apply for teaching positions
- **Real-time Chat**: Socket.io powered messaging system
- **File Uploads**: Cloudinary integration for photos and documents
- **Admin Dashboard**: Complete admin panel with analytics
- **Review System**: Teachers can review schools and vice versa
- **Application Tracking**: Full ATS functionality for schools

## Tech Stack

- **Node.js** with Express.js
- **MongoDB** with Mongoose ODM
- **Socket.io** for real-time communication
- **JWT** for authentication
- **Cloudinary** for file uploads
- **Express Validator** for input validation
- **Helmet** for security
- **Rate Limiting** for API protection

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user
- `PUT /api/auth/profile` - Update profile
- `PUT /api/auth/change-password` - Change password

### Schools
- `GET /api/schools/profile` - Get school profile
- `PUT /api/schools/profile` - Update school profile
- `POST /api/schools/upload-photos` - Upload school photos
- `POST /api/schools/jobs` - Post new job
- `GET /api/schools/jobs` - Get school's jobs
- `GET /api/schools/jobs/:id/applications` - Get job applications
- `PUT /api/schools/applications/:id/status` - Update application status
- `POST /api/schools/applications/:id/interview` - Schedule interview

### Teachers
- `GET /api/teachers/profile` - Get teacher profile
- `PUT /api/teachers/profile` - Update teacher profile
- `POST /api/teachers/upload-resume` - Upload resume
- `GET /api/teachers/jobs/search` - Search jobs
- `GET /api/teachers/jobs/:id` - Get job details
- `POST /api/teachers/jobs/:id/apply` - Apply for job
- `GET /api/teachers/applications` - Get applications
- `POST /api/teachers/jobs/:id/save` - Save job
- `GET /api/teachers/saved-jobs` - Get saved jobs
- `POST /api/teachers/schools/:id/review` - Review school

### Jobs (Public)
- `GET /api/jobs` - Get all jobs
- `GET /api/jobs/:id` - Get job by ID
- `GET /api/jobs/recent` - Get recent jobs
- `GET /api/jobs/urgent` - Get urgent jobs
- `GET /api/schools/featured` - Get featured schools
- `GET /api/schools/search` - Search schools
- `GET /api/stats/jobs` - Get job statistics

### Chat
- `POST /api/chat/messages` - Send message
- `GET /api/chat/messages/:applicationId` - Get messages
- `GET /api/chat/conversations` - Get conversations
- `PUT /api/chat/messages/:id/read` - Mark as read
- `DELETE /api/chat/messages/:id` - Delete message
- `GET /api/chat/unread-count` - Get unread count

### Admin
- `GET /api/admin/dashboard` - Dashboard stats
- `GET /api/admin/users` - Get all users
- `PUT /api/admin/users/:id/status` - Update user status
- `PUT /api/admin/schools/:id/verify` - Verify school
- `GET /api/admin/verifications` - Get pending verifications
- `GET /api/admin/jobs` - Get all jobs (admin)
- `PUT /api/admin/jobs/:id/status` - Update job status
- `GET /api/admin/applications` - Get all applications
- `GET /api/admin/analytics` - Get system analytics

## Socket.io Events

### Client to Server
- `join_application` - Join application chat room
- `send_message` - Send message
- `typing_start` - Start typing indicator
- `typing_stop` - Stop typing indicator
- `mark_messages_read` - Mark messages as read
- `set_online_status` - Set online status

### Server to Client
- `new_message` - New message received
- `message_notification` - Message notification
- `user_typing` - User typing indicator
- `messages_read` - Messages marked as read
- `user_status_change` - User online status change
- `joined_application` - Successfully joined application
- `recent_messages` - Recent messages for application

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd teacherslink-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp env.example .env
   ```
   
   Update `.env` with your configuration:
   ```env
   NODE_ENV=development
   PORT=5000
   MONGODB_URI=mongodb://localhost:27017/teacherslink
   JWT_SECRET=your_super_secret_jwt_key_here
   JWT_EXPIRE=7d
   CLOUDINARY_CLOUD_NAME=your_cloud_name
   CLOUDINARY_API_KEY=your_api_key
   CLOUDINARY_API_SECRET=your_api_secret
   FRONTEND_URL=http://localhost:5173
   ```

4. **Start MongoDB**
   - Local: `mongod`
   - Or use MongoDB Atlas

5. **Run the application**
   ```bash
   # Development
   npm run dev
   
   # Production
   npm start
   ```

## Database Models

### User
- Basic authentication and role management
- Email, password, role (teacher/school/admin)
- Verification and activation status

### School
- School profile information
- Contact details, facilities, photos
- Subscription plans and verification
- Reviews and achievements

### Teacher
- Personal and professional information
- Qualifications, experience, skills
- Preferences and availability
- Reviews and portfolio

### Job
- Job posting details
- Requirements and compensation
- Location and application details
- Status and metrics

### Application
- Job application tracking
- Status management and communication
- Interview scheduling
- Feedback and offers

### Message
- Real-time messaging
- File attachments support
- Read status and threading

## Security Features

- JWT authentication with role-based access
- Password hashing with bcrypt
- Rate limiting on API endpoints
- Helmet for security headers
- Input validation with express-validator
- CORS configuration
- File upload restrictions

## Development

### Scripts
- `npm start` - Start production server
- `npm run dev` - Start development server with nodemon
- `npm test` - Run tests

### Environment Variables
All required environment variables are documented in `env.example`.

### API Testing
Use tools like Postman or Insomnia to test the API endpoints. The server runs on `http://localhost:5000` by default.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details.








