from sklearn.preprocessing import OneHotEncoder
from xgboost import XGBClassifier
from sklearn.pipeline import Pipeline


@st.cache
def fit_model(model: Pipeline,
                      features: pd.DataFrame,
                      label: pd.DataFrame) -> Pipeline:
    """Alias for `fit` methods of `Pipeline` object and implements streamlit cachi
    so we haven't to load the data all of the times that we rerun
    """
    model.fit(features, label)
    return model


X, y = make_classification(
    n_informative=5, n_redundant=0, random_state=42
)

enc = OneHotEncoder(drop='first')
xgb = XGBClassifier()
pipeline = Pipeline([('one_hot_encoder', enc),
                               ('xgboost', xgb)])

fit_model(pipeline, X, y)

