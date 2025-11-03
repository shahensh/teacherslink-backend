const Job = require('../models/Job');
const JobAnalytics = require('../models/JobAnalytics');
const JobApplication = require('../models/JobApplication');
const School = require('../models/School');

class JobService {
  // Create a new job with analytics
  static async createJob(jobData, userId) {
    try {
      // Get school information
      const school = await School.findOne({ user: userId });
      if (!school) {
        throw new Error('School profile not found');
      }

      // Create job
      const job = await Job.create({
        ...jobData,
        school: school._id,
        postedBy: userId
      });

      // Create analytics record
      await JobAnalytics.create({
        job: job._id,
        school: school._id
      });

      return job;
    } catch (error) {
      throw error;
    }
  }

  // Get jobs with advanced filtering
  static async getJobs(filters = {}, pagination = {}) {
    try {
      const {
        search,
        department,
        employmentType,
        location,
        salaryMin,
        salaryMax,
        sortBy = 'createdAt',
        sortOrder = 'desc',
        page = 1,
        limit = 10
      } = { ...filters, ...pagination };

      // Build filter object
      const filter = {
        status: 'active',
        isActive: true,
        expiresAt: { $gt: new Date() }
      };

      // Add search filter
      if (search) {
        filter.$or = [
          { title: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
          { tags: { $in: [new RegExp(search, 'i')] } }
        ];
      }

      // Add filters
      if (department) filter.department = department;
      if (employmentType) filter.employmentType = employmentType;
      if (location) filter['location.city'] = { $regex: location, $options: 'i' };
      
      if (salaryMin || salaryMax) {
        filter['salary.min'] = {};
        if (salaryMin) filter['salary.min'].$gte = parseInt(salaryMin);
        if (salaryMax) filter['salary.max'] = { $lte: parseInt(salaryMax) };
      }

      // Build sort object
      const sort = {};
      sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

      // Calculate pagination
      const skip = (parseInt(page) - 1) * parseInt(limit);

      // Execute query
      const jobs = await Job.find(filter)
        .populate('school', 'schoolName address contactInfo')
        .populate('postedBy', 'email')
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit));

      // Get total count
      const total = await Job.countDocuments(filter);

      return {
        jobs,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / parseInt(limit)),
          total,
          limit: parseInt(limit)
        }
      };
    } catch (error) {
      throw error;
    }
  }

  // Get job by ID with analytics
  static async getJobById(jobId, incrementViews = false) {
    try {
      const job = await Job.findById(jobId)
        .populate('school', 'schoolName address contactInfo description')
        .populate('postedBy', 'email role');

      if (!job) {
        throw new Error('Job not found');
      }

      // Increment views if requested
      if (incrementViews) {
        await job.incrementViews();
        
        // Update analytics
        const analytics = await JobAnalytics.findOne({ job: jobId });
        if (analytics) {
          await analytics.incrementViews();
        }
      }

      return job;
    } catch (error) {
      throw error;
    }
  }

  // Update job
  static async updateJob(jobId, updateData, userId) {
    try {
      const job = await Job.findById(jobId);
      if (!job) {
        throw new Error('Job not found');
      }

      // Check ownership
      if (job.postedBy.toString() !== userId) {
        throw new Error('Not authorized to update this job');
      }

      const updatedJob = await Job.findByIdAndUpdate(
        jobId,
        updateData,
        { new: true, runValidators: true }
      ).populate('school', 'schoolName address contactInfo');

      return updatedJob;
    } catch (error) {
      throw error;
    }
  }

  // Delete job and related data
  static async deleteJob(jobId, userId) {
    try {
      const job = await Job.findById(jobId);
      if (!job) {
        throw new Error('Job not found');
      }

      // Check ownership
      if (job.postedBy.toString() !== userId) {
        throw new Error('Not authorized to delete this job');
      }

      // Delete related data
      await JobApplication.deleteMany({ job: jobId });
      await JobAnalytics.deleteOne({ job: jobId });
      await Job.findByIdAndDelete(jobId);

      return { message: 'Job deleted successfully' };
    } catch (error) {
      throw error;
    }
  }

  // Publish job
  static async publishJob(jobId, userId) {
    try {
      const job = await Job.findById(jobId);
      if (!job) {
        throw new Error('Job not found');
      }

      // Check ownership
      if (job.postedBy.toString() !== userId) {
        throw new Error('Not authorized to publish this job');
      }

      job.status = 'active';
      job.isActive = true;
      await job.save();

      return job;
    } catch (error) {
      throw error;
    }
  }

  // Pause job
  static async pauseJob(jobId, userId) {
    try {
      const job = await Job.findById(jobId);
      if (!job) {
        throw new Error('Job not found');
      }

      // Check ownership
      if (job.postedBy.toString() !== userId) {
        throw new Error('Not authorized to pause this job');
      }

      job.status = 'paused';
      job.isActive = false;
      await job.save();

      return job;
    } catch (error) {
      throw error;
    }
  }

  // Get jobs by school
  static async getJobsBySchool(schoolId, filters = {}) {
    try {
      const { page = 1, limit = 10, status } = filters;
      
      const filter = { school: schoolId };
      if (status) filter.status = status;

      const skip = (parseInt(page) - 1) * parseInt(limit);

      const jobs = await Job.find(filter)
        .populate('school', 'schoolName address contactInfo')
        .populate('postedBy', 'email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      const total = await Job.countDocuments(filter);

      return {
        jobs,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / parseInt(limit)),
          total,
          limit: parseInt(limit)
        }
      };
    } catch (error) {
      throw error;
    }
  }

  // Get user's jobs
  static async getUserJobs(userId, filters = {}) {
    try {
      const { page = 1, limit = 10, status } = filters;
      
      const filter = { postedBy: userId };
      if (status) filter.status = status;

      const skip = (parseInt(page) - 1) * parseInt(limit);

      const jobs = await Job.find(filter)
        .populate('school', 'schoolName address contactInfo')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      const total = await Job.countDocuments(filter);

      return {
        jobs,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / parseInt(limit)),
          total,
          limit: parseInt(limit)
        }
      };
    } catch (error) {
      throw error;
    }
  }

  // Get featured jobs
  static async getFeaturedJobs(limit = 6) {
    try {
      const jobs = await Job.find({
        status: 'active',
        isActive: true,
        isFeatured: true,
        expiresAt: { $gt: new Date() }
      })
        .populate('school', 'schoolName address contactInfo')
        .populate('postedBy', 'email')
        .sort({ createdAt: -1 })
        .limit(parseInt(limit));

      return jobs;
    } catch (error) {
      throw error;
    }
  }

  // Search jobs with text search
  static async searchJobs(searchQuery, filters = {}) {
    try {
      const {
        location,
        department,
        employmentType,
        page = 1,
        limit = 10
      } = filters;

      const filter = {
        status: 'active',
        isActive: true,
        expiresAt: { $gt: new Date() },
        $text: { $search: searchQuery }
      };

      if (location) {
        filter['location.city'] = { $regex: location, $options: 'i' };
      }
      if (department) filter.department = department;
      if (employmentType) filter.employmentType = employmentType;

      const skip = (parseInt(page) - 1) * parseInt(limit);

      const jobs = await Job.find(filter, { score: { $meta: 'textScore' } })
        .populate('school', 'schoolName address contactInfo')
        .populate('postedBy', 'email')
        .sort({ score: { $meta: 'textScore' } })
        .skip(skip)
        .limit(parseInt(limit));

      const total = await Job.countDocuments(filter);

      return {
        jobs,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / parseInt(limit)),
          total,
          limit: parseInt(limit)
        }
      };
    } catch (error) {
      throw error;
    }
  }

  // Get job statistics
  static async getJobStats(jobId) {
    try {
      const job = await Job.findById(jobId);
      if (!job) {
        throw new Error('Job not found');
      }

      const analytics = await JobAnalytics.findOne({ job: jobId });
      const applications = await JobApplication.find({ job: jobId });

      return {
        job,
        analytics,
        applications: {
          total: applications.length,
          byStatus: applications.reduce((acc, app) => {
            acc[app.status] = (acc[app.status] || 0) + 1;
            return acc;
          }, {})
        }
      };
    } catch (error) {
      throw error;
    }
  }

  // Auto-expire jobs
  static async expireJobs() {
    try {
      const expiredJobs = await Job.find({
        expiresAt: { $lt: new Date() },
        status: 'active'
      });

      for (const job of expiredJobs) {
        job.status = 'expired';
        job.isActive = false;
        await job.save();
      }

      return { expired: expiredJobs.length };
    } catch (error) {
      throw error;
    }
  }

  // Get similar jobs
  static async getSimilarJobs(jobId, limit = 5) {
    try {
      const job = await Job.findById(jobId);
      if (!job) {
        throw new Error('Job not found');
      }

      const similarJobs = await Job.find({
        _id: { $ne: jobId },
        $or: [
          { department: job.department },
          { employmentType: job.employmentType },
          { tags: { $in: job.tags } }
        ],
        status: 'active',
        isActive: true,
        expiresAt: { $gt: new Date() }
      })
        .populate('school', 'schoolName address contactInfo')
        .limit(parseInt(limit));

      return similarJobs;
    } catch (error) {
      throw error;
    }
  }
}

module.exports = JobService;




