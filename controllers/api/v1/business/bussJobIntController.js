const Job = require('../../../../models/api/v1/Jobs');
const { User } = require('../../../../models/api/v1/User');
const Business = require('../../../../models/api/v1/Business');
const { CustomError } = require('../../../../middlewares/errorHandler');
const { sendJobOfferEmail } = require('../shared/mailController');
const JobApplication = require('../../../../models/api/v1/JobApplication');

// get all business applications
const getAllBusinessApplications = async (req, res, next) => {
    try {
        const businessId = req.params.id;
        const jobs = await Job.find({ businessId }).populate({
            path: 'applications',
            populate: {
                path: 'user',
                select: 'username email'
            }
        });

        if (!jobs) {
            return res.status(404).json({ message: 'No jobs found for the business' });
        }

        let allApplications = [];
        for (const job of jobs) {
            for (const application of job.applications) {
                allApplications.push({
                    applicationId: application._id,
                    jobId: job._id,
                    userId: application.user._id,
                    jobTitle: job.title,
                    jobFunction: job.jobFunction,
                    Date: application.date,
                    user: {
                        username: application.user.username,
                        email: application.user.email
                    }
                });
            }
        }

        res.status(200).json({ applications: allApplications });
    } catch (error) {
        next(error);
    }
};

// offer job
const offerJob = async (req, res, next) => {
    try {
        const jobId = req.params.jobId;
        const { email } = req.body;
        const userId = req.user.userId;

        // find logged in user
        const loggedInUser = await User.findById(userId);
        if (!loggedInUser) {
            throw new CustomError('User not found', 404);
        }

        // find job by id
        const job = await Job.findById(jobId);
        if (!job) {
            throw new CustomError('Job not found', 404);
        }

        // ensure job belongs to logged in user's business
        const businessId = loggedInUser.businessData;
        const business = await Business.findById(businessId);
        if (!business) {
            throw new CustomError('Business not found', 404);
        }

        // find crew member by email
        const crewMember = await User.findOne({ email });
        if (!crewMember) {
            console.error('Crew Member not found:', email);
            throw new CustomError('Crew member not found', 404);
        }

        // ensure found user is a crew member
        if (!crewMember.roles.includes('crew')) {
            console.error('User found, but not a crew member:', email);
            throw new CustomError('Invalid crew member email', 400);
        }

        // ensure crew member isn't already offered job
        if (crewMember.userJobs.offered_jobs.includes(jobId)) {
            throw new CustomError('Job already offered to crew member', 400);
        }

        // offer job to crew member
        job.offeredTo = crewMember._id;
        await job.save();

        // add job to crew member's offered jobs
        crewMember.userJobs.offered_jobs.push(job._id);
        await crewMember.save();

        // add job to business's offered jobs
        business.businessJobs.offeredJobs.push(job._id);
        await business.save();

        // send an email to crew member about job offer
        await sendJobOfferEmail(crewMember.email, crewMember, business);

        res.status(200).json({ message: 'Job offered successfully', data: { job } });
    } catch (error) {
        next(error);
    }
};

// accept application
const acceptApplication = async (req, res, next) => {
    const { applicationId } = req.params;

    try {
        const application = await JobApplication.findById(applicationId);
        if (!application) {
            return res.status(404).json({ message: 'Application not found' });
        }

        const user = await User.findById(application.user);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const job = await Job.findById(application.job);
        if (!job) {
            return res.status(404).json({ message: 'Job not found' });
        }

        user.userJobs.active_jobs = [application.job];
        await user.save();

        job.activeCrew = application.user;
        await job.save();

        application.status = 'accepted';
        await application.save();

        res.status(200).json({ message: 'Application accepted successfully', application });
    } catch (error) {
        next(error);
    }
};

// reject application
const rejectApplication = async (req, res, next) => {
    const { applicationId } = req.params;

    try {
        const application = await JobApplication.findById(applicationId);
        if (!application) {
            return res.status(404).json({ message: 'Application not found' });
        }

        const user = await User.findById(application.user);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // ensure user has applications array
        if (!Array.isArray(user.userJobs.applications)) {
            user.userJobs.applications = [];
        }

        // remove application from user's applications
        user.userJobs.applications = user.userJobs.applications.filter(job => !job.equals(applicationId));
        await user.save();

        // remove application from database
        await JobApplication.deleteOne({ _id: applicationId });

        res.status(200).json({ message: 'Application rejected successfully' });
    } catch (error) {
        next(error);
    }
};

// get all active crew members
const getActiveCrewMembers = async (req, res, next) => {
    try {
        const jobsWithActiveCrew = await Job.find({ activeCrew: { $exists: true, $ne: null } })
            .populate('activeCrew', 'username email crewData');

        const activeCrewMembers = jobsWithActiveCrew.map(job => job.activeCrew);

        res.status(200).json({ activeCrewMembers });
    } catch (error) {
        console.error('Error fetching active crew members:', error);
        next(error);
    }
};

module.exports = {
    getAllBusinessApplications,
    offerJob,
    acceptApplication,
    rejectApplication,
    getActiveCrewMembers
};