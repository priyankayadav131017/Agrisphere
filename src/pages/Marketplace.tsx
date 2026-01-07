import { useState, useEffect } from "react";
import axios from "axios";
import { format } from "date-fns";
import {
  Calendar as CalendarIcon, TrendingUp, TrendingDown, Minus,
  IndianRupee, Clock, Sprout, ShoppingBag, MapPin, Phone,
  Search, Plus, LayoutGrid, Info, Truck, Sparkles, Map as MapIcon,
  Filter, CheckCircle2, AlertCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Badge } from "@/components/ui/badge";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from "recharts";
import { motion, AnimatePresence } from "framer-motion";

const Marketplace = () => {
  const [activeTab, setActiveTab] = useState("advisory");
  const [date, setDate] = useState<Date>();
  const [crop, setCrop] = useState<string>("");
  const [state, setState] = useState<string>("");
  const [acres, setAcres] = useState<string>("1");
  const [loading, setLoading] = useState(false);
  const [advisoryResult, setAdvisoryResult] = useState<any>(null);

  // Marketplace State
  const [listings, setListings] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isListingModalOpen, setIsListingModalOpen] = useState(false);
  const [newListing, setNewListing] = useState({
    farmer: "",
    crop: "",
    variety: "",
    quantity: "",
    price: "",
    location: "",
    contact: "",
    image: "https://images.unsplash.com/photo-1590779033100-9f60705a2f3b?auto=format&fit=crop&q=80&w=400"
  });

  const { toast } = useToast();

  useEffect(() => {
    fetchListings();
  }, []);

  const fetchListings = async () => {
    try {
      const response = await axios.get("http://localhost:5000/marketplace/listings");
      setListings(response.data);
    } catch (error) {
      console.error("Error fetching listings:", error);
    }
  };

  const handleAnalyze = async () => {
    if (!crop || !date) {
      toast({
        title: "Missing Information",
        description: "Please select a crop and sowing date.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const formattedDate = format(date, "yyyy-MM-dd");
      const response = await axios.post("http://localhost:5000/market-advisory", {
        crop,
        sowing_date: formattedDate,
        acres: parseFloat(acres) || 1,
        state: state
      });

      setAdvisoryResult(response.data);
      toast({
        title: "Market Intelligence Ready",
        description: "Seed-to-Market report has been generated.",
      });
    } catch (error) {
      toast({
        title: "Analysis Failed",
        description: "Could not fetch market data. Ensure server is running.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleListProduce = async () => {
    if (!newListing.crop || !newListing.price || !newListing.farmer) {
      toast({ title: "Error", description: "Please fill all required fields", variant: "destructive" });
      return;
    }

    try {
      await axios.post("http://localhost:5000/marketplace/list", newListing);
      toast({ title: "Success", description: "Your produce has been listed for buyers!" });
      setIsListingModalOpen(false);
      fetchListings();
    } catch (error) {
      toast({ title: "Error", description: "Could not post listing", variant: "destructive" });
    }
  };

  const handleViewRoute = (mandiName?: string) => {
    const destination = mandiName || (advisoryResult?.recommended_mandis?.[0]?.name) || "Agricultural Mandi";
    const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination + " " + (state || ""))}`;
    window.open(url, "_blank");
    toast({
      title: "Opening Navigation",
      description: `Calculating route to ${destination}...`,
    });
  };

  const filteredListings = listings.filter(l =>
    l.crop.toLowerCase().includes(searchQuery.toLowerCase()) ||
    l.location.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="container mx-auto p-4 max-w-7xl animate-fade-in mb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-4xl font-bold gradient-text mb-2">Market Intelligence Hub</h1>
          <p className="text-muted-foreground text-lg">
            Empowering farmers with AI-driven harvest planning and direct market access.
          </p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline" className="px-3 py-1 border-primary/30 text-primary bg-primary/5">
            <Sparkles className="w-3 h-3 mr-1" /> National Hackathon Edition
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="advisory" className="space-y-8" onValueChange={setActiveTab}>
        <div className="flex justify-center">
          <TabsList className="grid w-full max-w-md grid-cols-2 h-14 p-1 glass-morphism rounded-2xl">
            <TabsTrigger value="advisory" className="rounded-xl flex items-center gap-2 text-base data-[state=active]:bg-primary data-[state=active]:text-white transition-all">
              <TrendingUp className="w-4 h-4" /> Smart Advisory
            </TabsTrigger>
            <TabsTrigger value="marketplace" className="rounded-xl flex items-center gap-2 text-base data-[state=active]:bg-primary data-[state=active]:text-white transition-all">
              <ShoppingBag className="w-4 h-4" /> Farmer Marketplace
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="advisory">
          <div className="grid gap-6 lg:grid-cols-12">
            {/* Input Section */}
            <Card className="lg:col-span-4 h-fit border-primary/20 shadow-2xl metal-gradient-diagonal sticky top-24">
              <CardHeader className="bg-primary/5 rounded-t-xl border-b border-primary/10">
                <CardTitle className="flex items-center gap-2">
                  <Sprout className="h-6 w-6 text-primary" />
                  Crop Intelligence
                </CardTitle>
                <CardDescription>Enter details to simulate harvest outcomes</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 pt-6">
                <div className="space-y-2">
                  <Label>Select Crop</Label>
                  <Select onValueChange={setCrop} value={crop}>
                    <SelectTrigger className="rounded-xl h-11">
                      <SelectValue placeholder="Choose a crop" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="rice">Rice (Paddy)</SelectItem>
                      <SelectItem value="wheat">Wheat</SelectItem>
                      <SelectItem value="cotton">Cotton</SelectItem>
                      <SelectItem value="maize">Maize (Corn)</SelectItem>
                      <SelectItem value="tomato">Tomato</SelectItem>
                      <SelectItem value="potato">Potato</SelectItem>
                      <SelectItem value="sugarcane">Sugarcane</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>State (Optional)</Label>
                  <Select onValueChange={setState} value={state}>
                    <SelectTrigger className="rounded-xl h-11">
                      <SelectValue placeholder="All States" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ap">Andhra Pradesh</SelectItem>
                      <SelectItem value="arunachal">Arunachal Pradesh</SelectItem>
                      <SelectItem value="assam">Assam</SelectItem>
                      <SelectItem value="bihar">Bihar</SelectItem>
                      <SelectItem value="chhattisgarh">Chhattisgarh</SelectItem>
                      <SelectItem value="goa">Goa</SelectItem>
                      <SelectItem value="gujarat">Gujarat</SelectItem>
                      <SelectItem value="haryana">Haryana</SelectItem>
                      <SelectItem value="hp">Himachal Pradesh</SelectItem>
                      <SelectItem value="jharkhand">Jharkhand</SelectItem>
                      <SelectItem value="karnataka">Karnataka</SelectItem>
                      <SelectItem value="kerala">Kerala</SelectItem>
                      <SelectItem value="mp">Madhya Pradesh</SelectItem>
                      <SelectItem value="maharashtra">Maharashtra</SelectItem>
                      <SelectItem value="manipur">Manipur</SelectItem>
                      <SelectItem value="meghalaya">Meghalaya</SelectItem>
                      <SelectItem value="mizoram">Mizoram</SelectItem>
                      <SelectItem value="nagaland">Nagaland</SelectItem>
                      <SelectItem value="odisha">Odisha</SelectItem>
                      <SelectItem value="punjab">Punjab</SelectItem>
                      <SelectItem value="rajasthan">Rajasthan</SelectItem>
                      <SelectItem value="sikkim">Sikkim</SelectItem>
                      <SelectItem value="tn">Tamil Nadu</SelectItem>
                      <SelectItem value="telangana">Telangana</SelectItem>
                      <SelectItem value="tripura">Tripura</SelectItem>
                      <SelectItem value="up">Uttar Pradesh</SelectItem>
                      <SelectItem value="uk">Uttarakhand</SelectItem>
                      <SelectItem value="wb">West Bengal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Sowing Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-full justify-start text-left font-normal h-11 rounded-xl",
                            !date && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {date ? format(date, "MMM dd") : <span>Date</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar mode="single" selected={date} onSelect={setDate} initialFocus />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-2">
                    <Label>Acres</Label>
                    <Input
                      type="number"
                      placeholder="Size"
                      value={acres}
                      className="rounded-xl h-11"
                      onChange={(e) => setAcres(e.target.value)}
                    />
                  </div>
                </div>

                <Button
                  className="w-full bg-gradient-primary hover:shadow-glow-primary transition-all duration-300 h-12 rounded-xl font-bold text-lg"
                  onClick={handleAnalyze}
                  disabled={loading}
                >
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Analyzing...
                    </div>
                  ) : (
                    "Get Smart Advisory"
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Results Section */}
            <div className="lg:col-span-8 space-y-6">
              {advisoryResult ? (
                <AnimatePresence mode="wait">
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-6"
                  >
                    {/* Top Stats Cards */}
                    <div className="grid gap-4 md:grid-cols-3">
                      <Card className="bg-gradient-to-br from-blue-500/10 to-transparent border-l-4 border-l-blue-500 shadow-lg">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-semibold text-blue-600 dark:text-blue-400">Market Trend</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              {advisoryResult.market_trend.includes('Bullish') ? <TrendingUp className="text-green-500" /> : <TrendingDown className="text-red-500" />}
                              {advisoryResult.market_trend.split(' ')[0]}
                            </div>
                            <Badge variant="outline" className="text-[10px] py-0 h-5 bg-primary/5 text-primary border-primary/20 shrink-0">
                              {advisoryResult.data_source || 'Live'}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-2 font-medium line-clamp-2">{advisoryResult.advisory}</p>
                        </CardContent>
                      </Card>

                      <Card className="bg-gradient-to-br from-green-500/10 to-transparent border-l-4 border-l-green-500 shadow-lg">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-semibold text-green-600 dark:text-green-400">Yield & Revenue</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold text-green-600">
                            {advisoryResult.estimated_revenue}
                          </div>
                          <p className="text-xs text-muted-foreground mt-2 font-medium">Est. Yield: {advisoryResult.estimated_yield}</p>
                        </CardContent>
                      </Card>

                      <Card className="bg-gradient-to-br from-purple-500/10 to-transparent border-l-4 border-l-purple-500 shadow-lg">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-semibold text-purple-600 dark:text-purple-400">Harvest Window</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold flex items-center gap-2">
                            <Clock className="h-5 w-5 text-purple-500" />
                            {advisoryResult.days_to_harvest} Days
                          </div>
                          <p className="text-xs text-muted-foreground mt-2 font-medium">{advisoryResult.harvest_date_start}</p>
                        </CardContent>
                      </Card>
                    </div>

                    <div className="grid gap-6 md:grid-cols-2">
                      {/* Price Forecast */}
                      <Card className="shadow-xl">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-lg flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-primary" />
                            4-Week Price Forecast
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="h-[250px] pt-4">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={[
                              { week: 'Now', price: advisoryResult.current_price },
                              ...(advisoryResult.forecast || [])
                            ]}>
                              <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                              <XAxis dataKey="week" />
                              <YAxis domain={['auto', 'auto']} />
                              <RechartsTooltip
                                contentStyle={{ backgroundColor: 'hsl(var(--background))', borderRadius: '12px', border: '1px solid hsl(var(--border))' }}
                                formatter={(value: any) => [`₹${value}`, "Price"]}
                              />
                              <Line type="monotone" dataKey="price" stroke="#16a34a" strokeWidth={4} dot={{ r: 4, fill: "#16a34a" }} />
                            </LineChart>
                          </ResponsiveContainer>
                        </CardContent>
                      </Card>

                      {/* Mandi Recommendations */}
                      <Card className="shadow-xl overflow-hidden">
                        <CardHeader className="pb-2 bg-primary/5">
                          <CardTitle className="text-lg flex items-center gap-2">
                            <MapPin className="w-5 h-5 text-primary" />
                            Best Mandis to Sell
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                          <div className="divide-y">
                            {(advisoryResult.recommended_mandis || []).length > 0 ? (
                              (advisoryResult.recommended_mandis || []).map((mandi: any, idx: number) => (
                                <div key={idx} className="p-4 flex justify-between items-center hover:bg-muted/50 transition-colors">
                                  <div>
                                    <p className="font-bold">{mandi.name}</p>
                                    <p className="text-xs text-muted-foreground">{mandi.state} • {mandi.distance}</p>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <div className="text-right">
                                      <p className="text-lg font-bold text-primary">₹{mandi.price}</p>
                                      <p className="text-[10px] uppercase font-bold text-muted-foreground">Current Rate</p>
                                    </div>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-8 w-8 text-primary hover:bg-primary/10 rounded-full"
                                      onClick={() => handleViewRoute(mandi.name)}
                                    >
                                      <MapIcon className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="p-8 text-center text-muted-foreground text-sm">
                                No local Mandi data available for this region.
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </motion.div>
                </AnimatePresence>
              ) : (
                <div className="h-[500px] flex flex-col items-center justify-center text-center p-12 border-2 border-dashed rounded-3xl bg-muted/10 border-primary/20">
                  <motion.div
                    animate={{ rotate: [0, 10, -10, 0] }}
                    transition={{ repeat: Infinity, duration: 5 }}
                    className="bg-primary/10 p-6 rounded-full mb-6 shadow-glow-primary"
                  >
                    <TrendingUp className="h-12 w-12 text-primary" />
                  </motion.div>
                  <h3 className="text-2xl font-bold mb-4">Simulate Your Success</h3>
                  <p className="text-muted-foreground max-w-sm mb-8 text-lg">
                    Select your crop and sowing date to generate a comprehensive Seed-to-Market advisory report powered by AI.
                  </p>
                  <div className="flex flex-wrap gap-4 justify-center">
                    <Badge variant="secondary" className="px-4 py-2">Price Forecast</Badge>
                    <Badge variant="secondary" className="px-4 py-2">Mandi Finder</Badge>
                    <Badge variant="secondary" className="px-4 py-2">Seed Guide</Badge>
                  </div>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="marketplace">
          <div className="space-y-8">
            {/* Marketplace Actions */}
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-card p-4 rounded-2xl border shadow-md">
              <div className="relative w-full md:w-96">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Search crop or location..."
                  className="pl-10 h-11 rounded-xl"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="flex gap-3 w-full md:w-auto">
                <Button variant="outline" className="h-11 rounded-xl flex-1 md:flex-none">
                  <Filter className="w-4 h-4 mr-2" /> Filter
                </Button>
                <Dialog open={isListingModalOpen} onOpenChange={setIsListingModalOpen}>
                  <DialogTrigger asChild>
                    <Button className="bg-primary text-white h-11 rounded-xl hover:shadow-glow-primary transition-all flex-1 md:flex-none">
                      <Plus className="w-4 h-4 mr-2" /> Sell Produce
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[500px] rounded-3xl glass-morphism">
                    <DialogHeader>
                      <DialogTitle className="text-2xl font-bold text-primary">List Your Produce</DialogTitle>
                      <DialogDescription>Enter produce details for potential buyers to contact you.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Farmer Name</Label>
                          <Input placeholder="Your Name" value={newListing.farmer} onChange={e => setNewListing({ ...newListing, farmer: e.target.value })} className="rounded-xl h-11" />
                        </div>
                        <div className="space-y-2">
                          <Label>Crop Name</Label>
                          <Input placeholder="Ex: Wheat" value={newListing.crop} onChange={e => setNewListing({ ...newListing, crop: e.target.value })} className="rounded-xl h-11" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Quantity</Label>
                          <Input placeholder="Ex: 50 Quintals" value={newListing.quantity} onChange={e => setNewListing({ ...newListing, quantity: e.target.value })} className="rounded-xl h-11" />
                        </div>
                        <div className="space-y-2">
                          <Label>Price (₹ per Quintal)</Label>
                          <Input type="number" placeholder="Ex: 2400" value={newListing.price} onChange={e => setNewListing({ ...newListing, price: e.target.value })} className="rounded-xl h-11" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Location</Label>
                        <Input placeholder="City, State" value={newListing.location} onChange={e => setNewListing({ ...newListing, location: e.target.value })} className="rounded-xl h-11" />
                      </div>
                      <div className="space-y-2">
                        <Label>Contact Number</Label>
                        <Input placeholder="+91 XXXX XXXX" value={newListing.contact} onChange={e => setNewListing({ ...newListing, contact: e.target.value })} className="rounded-xl h-11" />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button onClick={handleListProduce} className="w-full h-12 rounded-xl bg-primary text-white">Post Listing</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {/* Marketplace Grid */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filteredListings.length > 0 ? (
                filteredListings.map((listing) => (
                  <motion.div
                    key={listing.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    whileHover={{ y: -5 }}
                    transition={{ duration: 0.3 }}
                  >
                    <Card className="overflow-hidden border-2 border-border/50 hover:border-primary/50 transition-all rounded-3xl shadow-xl hover:shadow-glow-primary">
                      <div className="h-48 relative overflow-hidden">
                        <img
                          src={listing.image}
                          alt={listing.crop}
                          className="w-full h-full object-cover transition-transform duration-500 hover:scale-110"
                        />
                        <Badge className="absolute top-4 right-4 bg-background/80 backdrop-blur-md text-foreground border-border">
                          {listing.date}
                        </Badge>
                        <div className="absolute bottom-4 left-4">
                          <Badge className="bg-primary text-white shadow-lg">Verified Farmer</Badge>
                        </div>
                      </div>
                      <CardHeader className="pb-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle className="text-2xl font-bold flex items-center gap-2">
                              {listing.crop}
                              <span className="text-sm font-normal text-muted-foreground">({listing.variety || 'Local'})</span>
                            </CardTitle>
                            <CardDescription className="flex items-center gap-1 mt-1">
                              <MapPin className="w-3 h-3" /> {listing.location}
                            </CardDescription>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-bold text-primary">₹{listing.price}</p>
                            <p className="text-[10px] text-muted-foreground font-bold italic">PER QUINTAL</p>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4 pt-2">
                        <div className="bg-muted/30 p-3 rounded-xl flex justify-between text-sm">
                          <div className="flex flex-col">
                            <span className="text-muted-foreground uppercase text-[10px] font-bold">Quantity</span>
                            <span className="font-bold">{listing.quantity}</span>
                          </div>
                          <div className="flex flex-col text-right">
                            <span className="text-muted-foreground uppercase text-[10px] font-bold">Farmer</span>
                            <span className="font-bold">{listing.farmer}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 p-3 border border-primary/20 bg-primary/5 rounded-xl">
                          <AlertCircle className="w-4 h-4 text-primary" />
                          <span className="text-[12px] font-medium">AI Pricing Suggestion: ₹{listing.price - 100} - ₹{listing.price + 200}</span>
                        </div>
                      </CardContent>
                      <CardFooter className="gap-2 pt-2">
                        <Button className="flex-1 rounded-xl h-11" variant="outline">
                          Details
                        </Button>
                        <Button className="flex-1 bg-primary text-white rounded-xl h-11">
                          <Phone className="w-4 h-4 mr-2" /> Contact
                        </Button>
                      </CardFooter>
                    </Card>
                  </motion.div>
                ))
              ) : (
                <div className="col-span-full py-20 text-center bg-muted/10 rounded-3xl border-2 border-dashed border-muted">
                  <ShoppingBag className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-xl font-bold">No Listings Found</h3>
                  <p className="text-muted-foreground">Try searching for other crops or be the first to list!</p>
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Marketplace;