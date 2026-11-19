import OneHopeDesign
import SwiftUI

/// Revival Coffee as published on myrevivalcoffee.com on Nov 19, 2026.
/// Order-ahead stays a coming-soon state. The live switch is the server flag.
public struct CoffeeView: View {
    public init() {}

    public var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text("Coffee. Community. Welcome.").font(.hopeDisplay)
                Text("Revival Coffee shares the building with One Hope. Menu and hours are from their site.")
                Text("Order ahead coming soon.").font(.headline)
                HStack {
                    if let maps = URL(string: "https://maps.apple.com/?address=1251%20S.%20Sherman%20St.%20Ste.%20112%2C%20Richardson%2C%20TX%2075081") {
                        Link("Directions", destination: maps).buttonStyle(.borderedProminent)
                    }
                    if let mail = URL(string: "mailto:info@myrevivalcoffee.com") {
                        Link("Email the shop", destination: mail).buttonStyle(.bordered)
                    }
                }
                Text("No public phone number is listed.").font(.footnote)
                VStack(alignment: .leading, spacing: 4) {
                    Text("Hours").font(.hopeTitle)
                    Text("Monday–Friday 7:00 AM – 3:00 PM")
                    Text("Saturday TBD")
                    Text("Sunday TBD")
                }
                .churchCard()
                menu("Coffee & Drinks", items: drinks)
                menu("Food & Pastries", items: food)
                VStack(alignment: .leading, spacing: 6) {
                    Text("Events").font(.headline)
                    Text("Their events page says coming soon. No dated events were listed.")
                }
                .churchCard()
            }
            .padding()
        }
        .background(BrandColor.paper)
        .navigationTitle("Revival Coffee")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func menu(_ title: String, items: [(String, String, String)]) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title).font(.hopeTitle)
            ForEach(items, id: \.0) { item in
                VStack(alignment: .leading, spacing: 2) {
                    Text("\(item.0) · \(item.2)").font(.headline)
                    Text(item.1).font(.footnote)
                }
            }
        }
        .churchCard()
    }

    private var drinks: [(String, String, String)] {
        [
            ("Espresso", "Bold, rich single or double shot", "$3.50"),
            ("Americano", "Espresso with hot water", "$4.00"),
            ("Latte", "Espresso with steamed milk and a touch of foam", "$5.00"),
            ("Cappuccino", "Equal parts espresso, steamed milk, and foam", "$5.00"),
            ("Cold Brew", "Slow-steeped for 18 hours", "$5.00"),
            ("Iced Latte", "Espresso over ice with cold milk", "$5.50"),
            ("Mocha", "Espresso, chocolate, and steamed milk", "$5.50"),
            ("Flat White", "Microfoam over a double shot", "$5.00"),
            ("Macchiato", "Espresso marked with foam", "$4.00"),
            ("Drip Coffee", "Freshly brewed house blend", "$3.00"),
        ]
    }

    private var food: [(String, String, String)] {
        [
            ("Breakfast Sandwich", "Egg, cheese, and protein on brioche", "$7.00"),
            ("Avocado Feta Toast", "Sourdough, tomatoes, feta, walnuts. Add egg $1.", "$10.00"),
            ("Overnight Oats Chia Pudding", "Blueberry or strawberry. The menu lists no price.", "Ask"),
            ("Yogurt Parfait", "Greek yogurt, granola, and fruit", "$6.00"),
            ("Three Cheese Grilled Cheese", "Cheddar, fontina, and Gruyère. Kettle chips.", "$10.00"),
            ("Tomato Mozzarella Sandwich", "Pesto and mozzarella on focaccia. Kettle chips.", "$10.00"),
            ("Chicken Pesto Wrap", "Chicken, pesto, and avocado. Kettle chips.", "$10.00"),
            ("Turkey Club Wrap", "Turkey, bacon, lettuce, tomato, and ranch", "$9.00"),
            ("Fresh Pastries", "Croissants, muffins, and scones", "$4.00"),
        ]
    }
}
