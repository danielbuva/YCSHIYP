import OpenModalButton from "../../../Modal/OpenModalButton";
import Review from "../ReviewButton/Review";

function EditReviewButton({ onClick, id, spotId }) {
  return (
    <OpenModalButton
      id="review-edit-button"
      text="edit"
      content={<Review id={id} spotId={spotId} />}
      onClick={onClick}
    />
  );
}

export default EditReviewButton;
