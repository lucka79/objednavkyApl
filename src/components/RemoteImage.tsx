import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type RemoteImageProps = {
  path?: string | null;
  fallback: string;
};

const RemoteImage = ({ path, fallback }: RemoteImageProps) => {
  const [image, setImage] = useState("");

  useEffect(() => {
    if (!path) return;
    (async () => {
      setImage("");
      const { data, error } = await supabase.storage
        .from("product-images")
        .download(path);
      // .download(path, { transform: { width: 50, height: 50 } });             placena verze asi

      if (error) {
        console.log(error);
      }

      if (data) {
        const fr = new FileReader();
        fr.readAsDataURL(data);
        fr.onload = () => {
          setImage(fr.result as string);
        };
      }
    })();
  }, [path]);

  if (!image) {
  }

  return <img src={image || fallback} />;
};

export default RemoteImage;
