import { useState } from "react";
import doveConvieneLogo from "/dove-conviene.png";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";
import { Button } from "./components/ui/button";
import { CATEGORIES, FLYERS, type Flyer as FlyerI } from "./models";
import { Spinner } from "./components/ui/spinner";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "./components/ui/accordion";
import Flyer from "./components/Flyer";
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card";
import { cn } from "./lib/utils";
import ProductsInputList from "./components/ProductsInputList";
// import Products from "./components/Products";

const App = () => {
  const [city, setCity] = useState("Rimini");
  const [flyers, setFlyers] = useState<Array<FlyerI>>([]);
  const [products, setProducts] = useState("pizza,chilly");
  const [results, setResults] = useState<Array<FlyerI>>([]);
  const [loading, setLoading] = useState(false);
  const [accordion, setAccordion] = useState<Array<string>>(
    CATEGORIES.map((c) => c.name)
  );

  const onRun = async () => {
    setLoading(true);
    const res = await fetch("/api/scraper", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        city,
        flyers,
        products: products.split(","),
      }),
    });
    const data = await res.json();
    setResults(data.flyers);
    setLoading(false);
  };

  const onFlyer = (flyer: FlyerI) => {
    console.log(flyer);
    const f = flyers.find((f) => f.name === flyer.name);
    if (f) {
      setFlyers(flyers.filter((f) => f.name !== flyer.name));
    } else {
      setFlyers(flyers.concat(flyer));
    }
  };

  return (
    <>
      <header>
        <div className="flex gap-4 items-center justify-between h-20 shadow">
          <div className="container ">
            <div className="max-w-50">
              <img src={doveConvieneLogo} alt="logo" />
            </div>
          </div>
        </div>
      </header>
      <main className="py-10">
        <div className="container">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>1 - Seleziona una località</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Label>Località</Label>
                <Input
                  onInput={(e) => setCity(e.currentTarget.value)}
                  value={city}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>2 - Seleziona i volantini</CardTitle>
              </CardHeader>
              <CardContent>
                <Accordion
                  className="space-y-2"
                  onValueChange={(c) => setAccordion(c)}
                  value={accordion}
                  type="multiple"
                >
                  {CATEGORIES.map((category) => {
                    const _flyers = FLYERS.filter(
                      (flyer) => flyer.category.name === category.name
                    );
                    return (
                      <AccordionItem value={category.name}>
                        <AccordionTrigger>{category.name}</AccordionTrigger>

                        <AccordionContent>
                          <div className="flex gap-4">
                            {_flyers.map((flyer) => {
                              return (
                                <Flyer
                                  className={cn(
                                    flyers.find((f) => f.name === flyer.name) &&
                                      "bg-amber-300"
                                  )}
                                  onClick={() => onFlyer(flyer)}
                                  {...flyer}
                                />
                              );
                            })}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>3 - Inserisci i prodotti (nome e prezzo)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Label>Prodotti</Label>
                <ProductsInputList onChange={() => {}} />
              </CardContent>
            </Card>

            <div className="space-y-2"></div>

            {/* {products && <Products flyers={results} />} */}

            <Button
              disabled={loading}
              className="flex gap-2 items-center"
              onClick={() => onRun()}
            >
              <span>Run</span>
              {loading && <Spinner />}
            </Button>
          </div>
        </div>
      </main>
    </>
  );
};

export default App;
