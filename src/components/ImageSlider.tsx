import { useState } from "react";
import { ChevronLeft, ChevronRight, CircleDot, Dot } from "lucide-react";

type ImageSliderProps = {
  imageUrl: string[];
};

export const ImageSlider = ({ imageUrl }: ImageSliderProps) => {
  const [imageIndex, setImageIndex] = useState(0);

  const showNextImage = () => {
    setImageIndex((index) => {
      if (index === imageUrl.length - 1) return 0;
      return index + 1;
    });
  };

  const showPrevImage = () => {
    setImageIndex((index) => {
      if (index === 0) return imageUrl.length - 1;
      return index - 1;
    });
  };

  return (
    <div className="p-2  max-w-[1200px] h-auto m-auto py-8 px-4 relative group">
      <div className="object-cover w-full h-full rounded-2xl overflow-hidden flex transition duration-700 ease-in-out">
        {imageUrl.map((url) => (
          <img
            key={url}
            src={url}
            style={{ translate: `${-100 * imageIndex}%` }} // zarovná images pod sebe
          />
        ))}
      </div>

      <button
        onClick={showPrevImage}
        className="hidden group-hover:block absolute top-[50%] -translate-x-0 translate-y-[-50%] left-10 text-2xl rounded-full p-2 bg-white/20 text-white cursor-pointer"
      >
        <ChevronLeft />
      </button>
      <button
        onClick={showNextImage}
        className="hidden group-hover:block absolute top-[50%] -translate-x-0 translate-y-[-50%] right-10 text-2xl rounded-full p-2 bg-white/20 text-white cursor-pointer"
      >
        <ChevronRight />
      </button>
      <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex gap-2 cursor-pointer rounded-full">
        {imageUrl.map((_, index) => (
          <button
            color="white"
            className="hover:scale-125 rounded-full"
            onClick={() => setImageIndex(index)}
          >
            {index === imageIndex ? (
              <CircleDot className=" outline outline-offset-2 text-white outline-stone-200/40 rounded-full fill-slate-50 size-2" />
            ) : (
              <Dot className="text-white" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
};
