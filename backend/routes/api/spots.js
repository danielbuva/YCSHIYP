const {
  Spot,
  Review,
  Booking,
  User,
  SpotImage,
} = require("../../db/models");
const {
  invariant,
  updateSpotInvariant,
  reviewInvariant,
} = require("../../services/error.server");
const { validateQuery } = require("../../services/validation.server");
const { verifyAuth } = require("../../services/auth.server");
const { Op, fn, col } = require("sequelize");
const router = require("express").Router();

router.get("/", async (req, res) => {
  let { page, size, minLat, maxLat, minLng, maxLng, minPrice, maxPrice } =
    req.query;

  const options = validateQuery({
    page,
    size,
    minLat,
    maxLat,
    minLng,
    maxLng,
    minPrice,
    maxPrice,
  });

  const Spots = await Spot.findAll(options);
  res.json({ Spots });
});

router.get("/current", verifyAuth, async (req, res) => {
  const Spots = await Spot.findAll({
    where: { ownerId: req.user.id },
    attributes: {
      include: [
        [fn("AVG", col("Reviews.stars")), "avgRating"],
        [fn("MAX", col("SpotImages.url")), "previewImage"],
      ],
    },
    include: [
      { model: SpotImage, attributes: [] },
      { model: Review, attributes: [] },
    ],
    group: ["Spot.id"],
  });

  res.json({ Spots });
});

router.get("/:spotId", async (req, res) => {
  const spot = await Spot.findByPk(req.params.spotId, {
    include: [
      { model: SpotImage },
      { model: Review, attributes: [] },
      {
        model: User,
        attributes: ["id", "username", "email"],
        as: "Owner",
      },
    ],
    attributes: {
      include: [
        [fn("count", col("Reviews.stars")), "numRating"],
        [fn("AVG", col("Reviews.stars")), "avgStarRating"],
      ],
      group: ["Spot.id"],
    },
  });

  invariant(spot.id);

  res.json(spot);
});

router.post("/", verifyAuth, async (req, res) => {
  const {
    address,
    city,
    state,
    country,
    lat,
    lng,
    name,
    description,
    price,
  } = req.body;

  updateSpotInvariant([
    address,
    city,
    country,
    lat,
    lng,
    name,
    description,
    price,
  ]);

  const newSpot = await Spot.create({
    ownerId: req.user.id,
    address,
    city,
    state,
    country,
    lat,
    lng,
    name,
    description,
    price,
  });

  res.status(201).json(newSpot);
});

router.post("/:spotId/images", verifyAuth, async (req, res) => {
  const { url, preview } = req.body;
  const spot = await Spot.findByPk(req.params.spotId);

  if (!spot) {
    return res.status(404).json({ message: "Spot couldn't be found" });
  }
  if (url) {
    spot.url = url;
  }
  if (preview) {
    spot.preview = preview;
  }

  await spot.save();

  res.json({ id: spot.id, url, preview });
});

router.put("/:spotId", verifyAuth, async (req, res) => {
  const {
    address,
    city,
    state,
    country,
    lat,
    lng,
    name,
    description,
    price,
  } = req.body;

  const spot = await Spot.findByPk(req.params.spotId, {
    where: { ownerId: req.user.id },
  });

  invariant(spot);
  updateSpotInvariant([
    address,
    city,
    country,
    lat,
    lng,
    name,
    description,
    price,
  ]);

  await spot.update({
    address,
    city,
    state,
    country,
    lat,
    lng,
    name,
    description,
    price,
  });

  res.json(spot);
});

router.delete("/:spotId", verifyAuth, async (req, res) => {
  const spot = await Spot.findOne({
    where: { ownerId: req.user.id, id: req.params.spotId },
  });
  invariant(spot);
  await spot.destroy();

  res.json({ message: "Successfully deleted" });
});

router.get("/:spotId/reviews", async (req, res) => {
  const spot = await Spot.findByPk(req.params.spotId, {
    attributes: ["id"],
  });
  invariant(spot.id);

  const review = await Review.findOne({
    where: { spotId: spot.id },
  });

  res.json(review);
});

router.post("/:spotId/reviews", verifyAuth, async (req, res) => {
  const { review, stars } = req.body;
  const { spotId } = req.params;
  const userId = req.user.id;
  reviewInvariant([review, stars]);

  const spot = await Spot.findByPk(spotId, {
    attributes: ["id"],
  });
  invariant(spot.id);

  const reviewExists = await Review.findOne({
    where: { spotId, userId },
  });

  if (reviewExists.id) {
    return next({
      message: "User already has a review for this spot",
    });
  }

  const newReview = await Review.create({ review, stars, spotId, userId });

  res.json(newReview);
});

router.get("/:spotId/bookings", verifyAuth, async (req, res, next) => {
  const userId = req.user.id;
  const { spotId } = req.params;
  let options;

  const userIsTheOwner = await Spot.findAll({
    where: { ownerId: userId, spotId },
  });

  if (userIsTheOwner.id) {
    options = { where: { spotId }, include: User };
  } else {
    options = {
      where: { spotId, userId },
      attributes: ["spotId", "startDate", "endDate"],
    };
  }
  const bookings = await Booking.findAll(options);
  invariant(bookings.id);

  res.json(bookings);
});

router.post("/:spotId/bookings", verifyAuth, async (req, res, next) => {
  const userId = req.user.id;
  const { startDate, endDate } = req.body;
  const { spotId } = req.params;

  const spot = await Spot.findByPk(spotId);
  invariant(spot.id);

  // maybe add this to booking model validations -.-

  const bookingConflicts = await Booking.findAll({
    where: {
      spotId,
      [Op.or]: [
        {
          startDate: {
            [Op.between]: [startDate, endDate],
          },
        },
        {
          endDate: {
            [Op.between]: [startDate, endDate],
          },
        },
        {
          [Op.and]: [
            {
              startDate: {
                [Op.lte]: startDate,
              },
            },
            {
              endDate: {
                [Op.gte]: endDate,
              },
            },
          ],
        },
      ],
    },
  });

  if (bookingConflicts.id) {
    next({
      message: "Bad Request",
      errors: {
        endDate: "endDate cannot come before startDate",
      },
      status: 400,
    });
  }

  const newBooking = await Booking.create({
    spotId,
    userId,
    startDate,
    endDate,
  });

  res.json(newBooking);
});

module.exports = router;
