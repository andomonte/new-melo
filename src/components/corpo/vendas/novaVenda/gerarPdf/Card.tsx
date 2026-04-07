import React from 'react';

interface CardProps {
  title?: string;
  imageId: number;
}

export const Card = ({
  title = 'Welcome to Our Sample Component',
  imageId,
}: CardProps) => {
  return (
    <div className="card-container">
      <img
        src={`https://picsum.photos/id/${imageId}/400/200`}
        alt="Sample"
        className="card-image"
      />
      <h2 className="card-title">{title}</h2>
      <p
        className="text-[16px]
                    leading-6
                    mb-[10px]"
      >
        Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nulla eget
        libero quam. Fusce efficitur, lectus ac commodo maximus, neque augue
        tincidunt tellus, id dictum odio eros ac nulla.
      </p>
      <p
        className="text-[16px]
                   leading-6
                    mb-[10px]"
      >
        Vivamus at urna sit amet justo auctor vestibulum ut nec nisl. Sed auctor
        augue eget libero tincidunt, ut dictum libero facilisis. Phasellus non
        libero at nisi eleifend tincidunt a eget ligula.
      </p>
    </div>
  );
};
