import { cn } from '@/lib/utils';
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

type CardProps = React.ComponentProps<typeof Card>;

interface DadoFilial {
  codigo_filial?: string;
  NOME_FILIAL?: string;
}

interface TudoProps {
  dadosFilial: DadoFilial[];
}

export default function CardFilial(
  { dadosFilial }: TudoProps,
  { className, ...props }: CardProps,
) {
  return (
    <div className="overflow-y-scroll h-full flex justify-center items-center w-full">
      <div className="mt-5 mb-5   w-full">
        {dadosFilial?.map((val, index: number) => {
          return (
            <div
              className=" flex justify-center h-auto mt-2 mb-2  w-[100%]"
              key={index}
            >
              <div className=" h-auto mt-2 w-[90%]">
                <Card
                  className={cn('w-[100%]  bg-[#347ab6] text-white', className)}
                  {...props}
                  onClick={() => {
                    //
                  }}
                >
                  <CardHeader>
                    <CardTitle>{val?.NOME_FILIAL}</CardTitle>
                    <CardDescription className="text-[#f0f0f0]">
                      {val?.codigo_filial}
                    </CardDescription>
                  </CardHeader>
                </Card>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
