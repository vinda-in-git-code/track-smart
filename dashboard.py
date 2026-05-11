import streamlit as st
import pandas as pd
import numpy as np
import plotly.express as px

# =========================
# PAGE CONFIG
# =========================
st.set_page_config(
    page_title="Track Smart Analysis",
    page_icon="💵",
    layout="wide"
)

# =========================
# COLOR PALETTE
# =========================
PRIMARY = "#6e7a73"    # Hijau Tua
TEXT_DARK = "#000000"  # Hitam Pekat
BACKGROUND = "#E4E9D3" # Warna Latar Belakang Baru (Light Green/Beige)
SIDEBAR_BG = "#cedad9" 
PALETTE = ["#9eb5b3", "#9ea6a2", "#9eb5a8", "#6e7a73", "#cedad9"]

# =========================
# CUSTOM CSS (PERBAIKAN HEADER & BACKGROUND)
# =========================
st.markdown(f"""
<style>
    /* Background Utama Aplikasi */
    .stApp {{
        background-color: {BACKGROUND};
    }}

    /* Judul Utama */
    .main-title {{
        font-size: 38px;
        font-weight: 800;
        color: {PRIMARY} !important;
        margin-bottom: 0px;
    }}

    /* Teks Pembuat */
    .creator-text {{
        font-size: 16px;
        color: {TEXT_DARK} !important;
        font-weight: 500;
        margin-bottom: 25px;
        opacity: 0.8;
    }}

    /* Sidebar Styling */
    [data-testid="stSidebar"] {{
        background-color: {SIDEBAR_BG} !important;
    }}
    [data-testid="stSidebar"] h2, [data-testid="stSidebar"] label p {{
        color: {TEXT_DARK} !important;
    }}

    /* Tabs Styling */
    .stTabs [data-baseweb="tab"] p {{
        color: {PRIMARY} !important;
    }}
    .stTabs [aria-selected="true"] p {{
        color: {TEXT_DARK} !important;
    }}

    /* KPI Cards (Tetap Putih agar Terlihat Kontras di atas Latar Hijau) */
    .card {{
        background-color: #ffffff;
        padding: 20px;
        border-radius: 12px;
        border: 1px solid #eeeeee;
        border-top: 6px solid {PRIMARY};
        text-align: center;
        box-shadow: 0 4px 10px rgba(0,0,0,0.05);
    }}
    .card-title {{ color: {PRIMARY} !important; font-weight: bold !important; }}
    .card-value {{ color: {TEXT_DARK} !important; font-size: 26px !important; font-weight: 800 !important; }}
</style>
""", unsafe_allow_html=True)

# =========================
# LOAD DATA
# =========================
@st.cache_data
def load_data():
    try:
        df = pd.read_csv("data_cleaned.csv")
        df["Date"] = pd.to_datetime(df["Date"])
        df["Year"] = df["Date"].dt.year
        return df
    except:
        return pd.DataFrame()

df = load_data()
if df.empty: 
    st.error("Data tidak ditemukan. Pastikan file 'data_cleaned.csv' tersedia.")
    st.stop()

expense_df = df[df["Transaction Type"] == "Expense"].copy()

# =========================
# SIDEBAR
# =========================
st.sidebar.markdown(f"## 📊 Filter Analisis")
selected_years = st.sidebar.multiselect("📅 Tahun", options=sorted(expense_df["Year"].unique()), default=sorted(expense_df["Year"].unique()))
selected_cats = st.sidebar.multiselect("📚 Kategori", options=sorted(expense_df["Category"].unique()), default=sorted(expense_df["Category"].unique()))

filtered_df = expense_df[(expense_df["Year"].isin(selected_years)) & (expense_df["Category"].isin(selected_cats))]

# =========================
# HEADER
# =========================
st.markdown('<div class="main-title">💵 Track Smart Analysis</div>', unsafe_allow_html=True)
st.markdown('<div class="creator-text">Dibuat oleh: Nabilah Yasmin Qasthalani & Vinda Karunia Surya</div>', unsafe_allow_html=True)

if not filtered_df.empty:
    # KPI Row
    m1, m2, m3 = st.columns(3)
    m1.markdown(f'<div class="card"><div class="card-title">Total Pengeluaran</div><div class="card-value">Rp {filtered_df["Amount_IDR"].sum():,.0f}</div></div>', unsafe_allow_html=True)
    m2.markdown(f'<div class="card"><div class="card-title">Jumlah Transaksi</div><div class="card-value">{len(filtered_df):,}</div></div>', unsafe_allow_html=True)
    m3.markdown(f'<div class="card"><div class="card-title">Kategori Terbesar</div><div class="card-value">{filtered_df.groupby("Category")["Amount_IDR"].sum().idxmax()}</div></div>', unsafe_allow_html=True)

    st.write("###")

    tab1, tab2, tab3 = st.tabs(["📈 Visualisasi Utama", "🥠 Analisis Proporsi", "📋 Tabel Data"])

    with tab1:
        # Bar Chart
        top_cat = filtered_df.groupby("Category")["Amount_IDR"].sum().reset_index().sort_values("Amount_IDR").tail(10)
        fig_bar = px.bar(top_cat, x="Amount_IDR", y="Category", orientation='h', title="Top 10 Kategori Pengeluaran",
                         color_discrete_sequence=[PRIMARY], text_auto='.2s', template="plotly_white")
        
        fig_bar.update_layout(
            font=dict(color=TEXT_DARK),
            title_font_color=PRIMARY,
            paper_bgcolor='rgba(0,0,0,0)',
            plot_bgcolor='rgba(0,0,0,0)',
            xaxis=dict(tickfont=dict(color=TEXT_DARK), title_font=dict(color=TEXT_DARK), gridcolor="rgba(0,0,0,0)"),
            yaxis=dict(tickfont=dict(color=TEXT_DARK), title_font=dict(color=TEXT_DARK), gridcolor="rgba(0,0,0,0)")
        )
        st.plotly_chart(fig_bar, use_container_width=True)

    with tab2:
        # Pie Charts
        needs_list = ["Transportation", "Food", "Family", "Household", "Health", "Education", "Rent", "Mortgage & Rent", "Utilities", "Mobile Phone", "Gas & Fuel", "Groceries", "Internet", "maid", "Cook", "garbage disposal", "water (jar /tanker)", "Auto Insurance"]
        filtered_df["Needs_vs_Wants"] = np.where(filtered_df["Category"].isin(needs_list), "Kebutuhan", "Keinginan")
        
        col_left, col_right = st.columns(2)
        with col_left:
            nvw_data = filtered_df.groupby("Needs_vs_Wants")["Amount_IDR"].sum().reset_index()
            fig_nvw = px.pie(nvw_data, values="Amount_IDR", names="Needs_vs_Wants", title="Rasio Kebutuhan vs Keinginan", hole=0.4, color_discrete_sequence=PALETTE, template="plotly_white")
            fig_nvw.update_layout(title_font_color=PRIMARY, font=dict(color=TEXT_DARK), legend_font_color=TEXT_DARK, paper_bgcolor='rgba(0,0,0,0)')
            fig_nvw.update_traces(textinfo='percent+label', textfont_color=TEXT_DARK)
            st.plotly_chart(fig_nvw, use_container_width=True)

        with col_right:
            split_bill_cats = ["Restaurants", "Fast Food", "Coffee Shops", "Food", "Alcohol & Bars"]
            split_df = filtered_df[filtered_df["Category"].isin(split_bill_cats)]
            if not split_df.empty:
                split_data = split_df["Category"].value_counts().reset_index().head(5)
                fig_split = px.pie(split_data, values="count", names="Category", title="Top 5 Kategori Split Bill", hole=0.4, color_discrete_sequence=PALETTE, template="plotly_white")
                fig_split.update_layout(title_font_color=PRIMARY, font=dict(color=TEXT_DARK), legend_font_color=TEXT_DARK, paper_bgcolor='rgba(0,0,0,0)')
                fig_split.update_traces(textinfo='percent+label', textfont_color=TEXT_DARK)
                st.plotly_chart(fig_split, use_container_width=True)

    with tab3:
        st.dataframe(filtered_df, use_container_width=True)
else:
    st.info("Pilih filter di sidebar.")