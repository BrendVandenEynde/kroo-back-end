const Job = require('../../../models/api/v1/Jobs');
const JobApplication = require('../../../models/api/v1/JobApplication');
const { User } = require('../../../models/api/v1/User');
const { sendApplicationMail, sendJobOfferEmail } = require('./mailController');
const Business = require('../../../models/api/v1/Business');
const jwt = require('jsonwebtoken');

// get all applications
const getApplications = async (req, res) => {
    try {
        const userId = req.user.userId;

        const user = await User.findById(userId).populate('userJobs.applications');
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const applications = user.userJobs.applications;
        res.status(200).json({ applications });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// get job application by ID
const getJobApplicationById = async (req, res) => {
    try {
        const { applicationId } = req.params;
        const userId = req.user.userId;

        const user = await User.findById(userId).populate('userJobs.applications');
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const application = user.userJobs.applications.find(app => app._id.toString() === applicationId);
        if (!application) {
            return res.status(404).json({ message: 'Job application not found' });
        }

        res.status(200).json({ application });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// apply for job
const applyJob = async (req, res) => {
    try {
        const { jobId } = req.params;
        const userId = req.user.userId;

        // check if jobId is provided
        if (!jobId) {
            return res.status(400).json({ message: 'Job ID is required' });
        }

        // find job by ID
        const job = await Job.findById(jobId);
        if (!job) {
            return res.status(404).json({ message: 'Job not found' });
        }

        // extract JWT token from Authorization header
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ message: 'Authorization header is missing' });
        }
        const token = authHeader;

        // decode the token to get user ID
        const decodedToken = jwt.verify(token, process.env.JWT_SECRET);

        // verify that the user ID from the token matches the one in the request
        if (userId !== decodedToken.userId) {
            return res.status(401).json({ message: 'Unauthorized access' });
        }

        // check if user has already applied for job
        const applicationExists = await JobApplication.findOne({ job: jobId, user: userId });
        if (applicationExists) {
            return res.status(400).json({ message: 'You have already applied for this job' });
        }

        // find business associated with job
        const business = await Business.findById(job.businessId);
        if (!business) {
            throw new Error('Business not found');
        }

        // create new application
        const application = new JobApplication({
            job: jobId,
            user: userId,
            date: new Date(),
            status: 'pending'
        });

        // save job application
        await application.save();

        // add application to job
        job.applications.push(application);
        await job.save();

        // find user
        const user = await User.findById(userId);
        user.userJobs.applications.push(application);
        await user.save();

        // send application email to business
        await sendApplicationMail(job, user, business);

        const populatedJob = await Job.findById(jobId).populate('applications');

        res.status(201).json({ message: 'Job application submitted successfully', job: populatedJob });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// delete job application
const deleteJobApplication = async (req, res) => {
    try {
        const { applicationId } = req.params;
        const userId = req.user.userId;

        if (!applicationId) {
            return res.status(400).json({ message: 'Application ID is required' });
        }

        const application = await JobApplication.findById(applicationId);
        if (!application) {
            return res.status(404).json({ message: 'Job application not found' });
        }

        if (application.user.toString() !== userId) {
            return res.status(403).json({ message: 'You are not authorized to delete this application' });
        }

        const job = await Job.findById(application.job);
        job.applications.pull(applicationId);
        await job.save();

        const user = await User.findById(userId);
        user.userJobs.applications.pull(applicationId);
        await user.save();

        await JobApplication.findByIdAndDelete(applicationId);

        res.status(200).json({ message: 'Job application deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// get all saved jobs
const getSavedJobs = async (req, res) => {
    try {
        const userId = req.user.userId;

        const user = await User.findById(userId).populate('userJobs.saved_jobs');
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const savedJobs = user.userJobs.saved_jobs;
        res.status(200).json({ savedJobs });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// get saved job by ID
const getSavedJobById = async (req, res) => {
    try {
        const { jobId } = req.params;
        const userId = req.user.userId;

        const user = await User.findById(userId).populate('userJobs.saved_jobs');
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const savedJob = user.userJobs.saved_jobs.find(job => job._id.toString() === jobId);
        if (!savedJob) {
            return res.status(404).json({ message: 'Saved job not found' });
        }

        res.status(200).json({ savedJob });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// save job to user
const saveJob = async (req, res) => {
    try {
        const { jobId } = req.params;
        const userId = req.user.userId;

        if (!jobId) {
            return res.status(400).json({ message: 'Job ID is required' });
        }

        const job = await Job.findById(jobId);
        if (!job) {
            return res.status(404).json({ message: 'Job not found' });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const isJobAlreadySaved = user.userJobs.saved_jobs.includes(jobId);
        if (isJobAlreadySaved) {
            return res.status(400).json({ message: 'Job is already saved' });
        }

        user.userJobs.saved_jobs.push(jobId);
        await user.save();

        res.status(200).json({ message: 'Job saved successfully', savedJobId: jobId });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// delete saved job from user
const deleteSavedJob = async (req, res) => {
    try {
        const { jobId } = req.params;
        const userId = req.user.userId;

        if (!jobId) {
            return res.status(400).json({ message: 'Job ID is required' });
        }

        const job = await Job.findById(jobId);
        if (!job) {
            return res.status(404).json({ message: 'Job not found' });
        }

        const user = await User.findById(userId);
        user.userJobs.saved_jobs.pull(jobId);
        await user.save();

        res.status(200).json({ message: 'Job deleted from saved jobs' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// offer job
const offerJob = async (req, res) => {
    try {
        const jobId = req.params.jobId;
        const { email } = req.body;
        const userId = req.user.userId;
        const loggedInUser = await User.findById(userId);
        const businessId = loggedInUser.businessData;
        const job = await Job.findById(jobId);
        const business = await Business.findById(businessId);
        const crewMember = await User.findOne({ email });

        if (!loggedInUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (!job) {
            return res.status(404).json({ message: 'Job not found' });
        }

        if (!business) {
            return res.status(404).json({ message: 'Business not found' });
        }

        if (!crewMember) {
            console.error('Crew Member not found:', email);
            return res.status(404).json({ message: 'Crew member not found' });
        }

        if (crewMember.role !== 'crew') {
            console.error('User found, but not a crew member:', email);
            return res.status(400).json({ message: 'Invalid crew member email' });
        }

        job.offeredTo = crewMember._id;
        await job.save();
        await sendJobOfferEmail(crewMember.email, crewMember, business);

        res.status(200).json({ message: 'Job offered successfully', data: { job } });
    } catch (error) {
        console.error('Error offering job:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

module.exports = {
    getApplications,
    getJobApplicationById,
    applyJob,
    deleteJobApplication,
    getSavedJobs,
    getSavedJobById,
    saveJob,
    deleteSavedJob,
    offerJob
};