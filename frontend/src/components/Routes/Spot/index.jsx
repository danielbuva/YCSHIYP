import { useEffect } from "react";
import { useDispatch } from "react-redux";
import { useParams } from "react-router-dom";
import { getSpot } from "../../../store/spots";
import SpotHeader from "./SpotHeader";
import SpotImages from "./SpotImages";
import ReserveBox from "./ReserveBox";
import Divider from "../../Divider";

import useSpot from "../../../hooks/useSpot";

import "./Spot.css";
import Rating from "./ReserveBox/Rating";
import ReviewButton from "./ReviewButton";
import Reviews from "./Reviews";
import useSessionUser from "../../../hooks/useSessionUser";

function Spot() {
  const { id } = useParams();
  const dispatch = useDispatch();
  const spot = useSpot();
  const user = useSessionUser();

  useEffect(() => {
    dispatch(getSpot(id));
  }, [dispatch, id]);

  if (!spot || !spot.Owner) return null;

  return (
    <div id="spot">
      <SpotHeader />
      <SpotImages />
      <div id="spot-details">
        <ReserveBox />
        <div id="spot-description-title">
          <h3>
            {spot.place} in a {spot.type} hosted by {spot.Owner.firstName},{" "}
            {spot.Owner.lastName}
          </h3>
          <Divider marginBottom="40px" />
          <p>{spot.description}</p>
        </div>
      </div>
      <Divider marginTop="40px" />
      <Rating size={1} />
      {spot.Owner.id !== user?.id && <ReviewButton id={id} />}
      <Reviews />
    </div>
  );
}

export default Spot;
