# MVVM instead of The Composable Architecture

The iOS bar allowed MVVM or TCA-style unidirectional state. We use small observable models and button intents. TCA would add a large dependency and a second vocabulary for this church app. The direction of data is still one way: the view does not write the store except through a method on the model or a local `@State` field. The phone targets iOS 18 and shows five tabs: Home, Watch, Prayer, Give, and Connect. Know Jesus is a card on Home and a link inside Connect.
