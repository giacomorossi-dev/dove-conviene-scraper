import { useState } from "react";
import doveConvieneLogo from "/dove-conviene.png";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "./components/ui/toggle-group";
import { BookmarkIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "./components/ui/alert";

const App = () => {
  const [city, setCity] = useState("Rimini");
  const [categories, setCategories] = useState(["cura-casa-e-corpo"]);
  const [flyers, setFlyers] = useState(["acqua & sapone"]);
  const [products, setProducts] = useState("pizza,chilly");

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
            <div className="space-y-2">
              <Label>Località</Label>
              <Input
                onInput={(e) => setCity(e.currentTarget.value)}
                value={city}
              />
            </div>
            <div className="space-y-2">
              <Label>Categorie</Label>
              <ToggleGroup
                value={categories}
                onValueChange={(categories) => setCategories(categories)}
                type="multiple"
                variant="outline"
                spacing={2}
                size="sm"
              >
                <ToggleGroupItem
                  value=" iper-e-super"
                  aria-label="Toggle star"
                  className="data-[state=on]:bg-transparent data-[state=on]:*:[svg]:fill-red-500 data-[state=on]:*:[svg]:stroke-red-500"
                >
                  <BookmarkIcon />
                  iper-e-super
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="cura-casa-e-corpo"
                  aria-label="Toggle heart"
                  className="data-[state=on]:bg-transparent data-[state=on]:*:[svg]:fill-red-500 data-[state=on]:*:[svg]:stroke-red-500"
                >
                  <BookmarkIcon />
                  cura-casa-e-corpo
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            <div className="space-y-2">
              <Label>Volantini</Label>
              <ToggleGroup
                value={flyers}
                onValueChange={(flyers) => setFlyers(flyers)}
                type="multiple"
                variant="outline"
                spacing={2}
                size="sm"
              >
                <ToggleGroupItem
                  value="conad superstore"
                  aria-label="Toggle star"
                  className="data-[state=on]:bg-transparent data-[state=on]:*:[svg]:fill-red-500 data-[state=on]:*:[svg]:stroke-red-500"
                >
                  <BookmarkIcon />
                  conad superstore
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="acqua & sapone"
                  aria-label="Toggle heart"
                  className="data-[state=on]:bg-transparent data-[state=on]:*:[svg]:fill-red-500 data-[state=on]:*:[svg]:stroke-red-500"
                >
                  <BookmarkIcon />
                  acqua & sapone
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
            <div className="space-y-2">
              <Label>Prodotti</Label>
              <Input
                onInput={(e) => setProducts(e.currentTarget.value)}
                value={products}
              />
            </div>
            <Alert>
              <AlertTitle>Query</AlertTitle>
              <AlertDescription>
                <div>Città: {city}</div>
                <div>Categorie: {categories.join(", ")}</div>
                <div>Volantini: {flyers.join(", ")}</div>
                <div>Prodotti: {products.split(",").join(", ")}</div>
              </AlertDescription>
            </Alert>
          </div>
        </div>
      </main>
    </>
  );
};

export default App;
