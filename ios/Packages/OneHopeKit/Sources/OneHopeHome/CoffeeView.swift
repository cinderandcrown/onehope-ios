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

    private func menu(_ title: String, items: [MenuLine]) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title).font(.hopeTitle)
            ForEach(items) { item in
                VStack(alignment: .leading, spacing: 2) {
                    Text("\(item.name) · \(item.price)").font(.headline)
                    Text(item.detail).font(.footnote)
                }
            }
        }
        .churchCard()
    }

    private var drinks: [MenuLine] {
        [
            MenuLine(name: "Espresso", detail: "Bold, rich single or double shot", price: "$3.50"),
            MenuLine(name: "Americano", detail: "Espresso with hot water", price: "$4.00"),
            MenuLine(name: "Latte", detail: "Espresso with steamed milk and a touch of foam", price: "$5.00"),
            MenuLine(name: "Cappuccino", detail: "Equal parts espresso, steamed milk, and foam", price: "$5.00"),
            MenuLine(name: "Cold Brew", detail: "Slow-steeped for 18 hours", price: "$5.00"),
            MenuLine(name: "Iced Latte", detail: "Espresso over ice with cold milk", price: "$5.50"),
            MenuLine(name: "Mocha", detail: "Espresso, chocolate, and steamed milk", price: "$5.50"),
            MenuLine(name: "Flat White", detail: "Microfoam over a double shot", price: "$5.00"),
            MenuLine(name: "Macchiato", detail: "Espresso marked with foam", price: "$4.00"),
            MenuLine(name: "Drip Coffee", detail: "Freshly brewed house blend", price: "$3.00"),
        ]
    }

    private var food: [MenuLine] {
        [
            MenuLine(name: "Breakfast Sandwich", detail: "Egg, cheese, and protein on brioche", price: "$7.00"),
            MenuLine(name: "Avocado Feta Toast", detail: "Sourdough, tomatoes, feta, walnuts. Add egg $1.", price: "$10.00"),
            MenuLine(name: "Overnight Oats Chia Pudding", detail: "Blueberry or strawberry. The menu lists no price.", price: "Ask"),
            MenuLine(name: "Yogurt Parfait", detail: "Greek yogurt, granola, and fruit", price: "$6.00"),
            MenuLine(name: "Three Cheese Grilled Cheese", detail: "Cheddar, fontina, and Gruyère. Kettle chips.", price: "$10.00"),
            MenuLine(name: "Tomato Mozzarella Sandwich", detail: "Pesto and mozzarella on focaccia. Kettle chips.", price: "$10.00"),
            MenuLine(name: "Chicken Pesto Wrap", detail: "Chicken, pesto, and avocado. Kettle chips.", price: "$10.00"),
            MenuLine(name: "Turkey Club Wrap", detail: "Turkey, bacon, lettuce, tomato, and ranch", price: "$9.00"),
            MenuLine(name: "Fresh Pastries", detail: "Croissants, muffins, and scones", price: "$4.00"),
        ]
    }
}

private struct MenuLine: Identifiable {
    let name: String
    let detail: String
    let price: String

    var id: String { name }
}
