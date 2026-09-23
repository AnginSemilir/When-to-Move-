// Data used by the model. Update these when new figures are published.

// Average 2026 mortgage rates (%) by maximum loan-to-value band.
// Rough year averages from Moneyfacts, Rightmove and similar trackers.
// Users can still edit these on the page.
const BANDS=[[60,4.7],[75,4.9],[80,5.1],[85,5.3],[90,5.6],[95,5.9]];

// UK HPI-derived growth, % a year: [long-run 2016-26, last 12 months to Jul 2026]
const REGION={'North East':[2.7,4.9],'North West':[3.9,4.4],'Yorkshire and the Humber':[3.4,2.8],'East Midlands':[3.5,1.8],'West Midlands':[3.4,1.4],'East of England':[2.2,0.6],'London':[1.3,-3.3],'South East':[2.2,0.3],'South West':[2.4,-0.2],'Wales':[3.8,2.6],'Scotland':[3.2,2.3],'Northern Ireland':[4.4,4.4]};
// What a home would rent for, as a share of its value each year (gross rental yield).
// Used to turn "how much more you'd value the new home" into pounds for home owners.
const RENT_YIELD=0.045;

const TYPE={'All types':[0,0],'Detached':[0.6,0.3],'Semi-detached':[0.7,1.6],'Terraced':[0.5,1.2],'Flat or maisonette':[-1.5,-4.6]};
